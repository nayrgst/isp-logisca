'use client';

/* Peças do modo seleção do quadro, iguais no card individual e no da dupla. */

/** Caixa de marcação no lugar do puxador de arrastar. Só visual: quem recebe o
    clique é o SelectionOverlay, que cobre o card inteiro. */
export function SelectionCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-150 ${
        checked ? 'border-brand bg-brand text-white' : 'border-line-strong bg-canvas'
      }`}
    >
      {checked && (
        <svg className="h-3 w-3 animate-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

/** Camada que cobre o card no modo seleção: o card inteiro vira alvo de clique
    (marcar vários no domingo fica rápido) e os controles do card não são
    acionados sem querer enquanto se seleciona. */
export function SelectionOverlay({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={`${checked ? 'Desmarcar' : 'Selecionar'} ${label}`}
      className={`absolute inset-0 z-10 cursor-pointer rounded-[inherit] transition-colors duration-150 ${
        checked ? 'bg-brand/8' : 'hover:bg-brand/4'
      }`}
    />
  );
}
