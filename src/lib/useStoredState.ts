import { useCallback, useSyncExternalStore } from 'react';

/* Preferência guardada no localStorage (filtro, regional, busca) sem quebrar a
   hidratação. Ler o localStorage direto no useState fazia o primeiro render do
   navegador divergir do HTML do servidor ("Hydration failed") e o React
   descartava e refazia a árvore inteira do quadro a cada carregamento.
   Com useSyncExternalStore o servidor e a hidratação usam o valor padrão, e o
   valor salvo entra logo em seguida, sem erro. */

const CHANGE_EVENT = 'isp-logistica:stored-state';

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Modo privado / armazenamento cheio: a preferência só não persiste.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useStoredState<T extends string>(
  key: string,
  fallback: T,
  parse: (raw: string | null) => T
) {
  const value = useSyncExternalStore(
    subscribe,
    () => parse(readStorage(key)),
    () => fallback
  );

  const setValue = useCallback(
    (next: T) => {
      writeStorage(key, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key]
  );

  return [value, setValue] as const;
}
