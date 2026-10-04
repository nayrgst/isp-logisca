'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBoardActions, type MoveTarget } from '@/components/BoardActions';
import { ChipButton } from '@/components/ui/ChipButton';

const MENU_WIDTH = 224;
const GAP = 6;

interface Props {
  cellId: string;
  /** Nome que aparece no título do botão, ex.: "Roni Maicon" ou "a dupla". */
  label: string;
  disabled?: boolean;
}

/* Botão "Mover" do card: lista as cidades da regional (com quantos técnicos
   cada uma tem agora) e Ausente. Alternativa ao arrastar, que fica lento
   quando a coluna de destino está longe na rolagem lateral do quadro.

   O menu abre num portal com posição fixa: dentro da coluna ele seria cortado
   pela rolagem da própria coluna nos cards perto do fim. */
export function MoveMenu({ cellId, label, disabled = false }: Props) {
  const actions = useBoardActions();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<MoveTarget[]>([]);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  function toggle() {
    if (!actions || disabled) return;
    if (open) {
      close();
      return;
    }
    // A lista é montada na hora de abrir, com as contagens atuais.
    setTargets(actions.getMoveTargets(cellId));
    setOpen(true);
  }

  // Posiciona abaixo do botão, alinhado à direita; se não couber, abre para cima.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const fitsBelow = trigger.bottom + GAP + menuHeight <= window.innerHeight - 8;
    const top = fitsBelow ? trigger.bottom + GAP : Math.max(8, trigger.top - GAP - menuHeight);
    const left = Math.min(
      Math.max(8, trigger.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8
    );

    setPosition({ top, left });
  }, [open, close]);

  useEffect(() => {
    if (!open) return;

    menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    }
    // Qualquer rolagem (coluna ou quadro) tiraria o menu do lugar: fecha.
    function handleScroll(event: Event) {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  function handleSelect(target: MoveTarget) {
    close();
    if (target.isCurrent || !actions) return;
    actions.moveCell(cellId, target.id);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  if (!actions) return null;

  const cities = targets.filter((target) => !target.isAbsent);
  const absent = targets.find((target) => target.isAbsent);

  return (
    <>
      <ChipButton
        ref={triggerRef}
        active={open}
        onClick={toggle}
        disabled={disabled}
        title={`Mover ${label} para outra cidade ou para Ausente`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex items-center gap-1"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
        Mover
      </ChipButton>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Mover ${label} para`}
            onKeyDown={handleMenuKeyDown}
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: MENU_WIDTH,
            }}
            className={`fixed z-[1050] overflow-hidden rounded-card border border-line-strong bg-overlay py-1 shadow-popover ${
              position ? 'animate-pop' : 'invisible'
            }`}
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              Mover para
            </p>
            <div className="max-h-72 overflow-y-auto">
              {cities.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(target)}
                  disabled={target.isCurrent}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-surface-hover focus:bg-surface-hover focus:outline-none disabled:cursor-default disabled:text-ink-subtle disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 truncate">{target.name}</span>
                  {target.isCurrent ? (
                    <span className="shrink-0 text-[11px] text-ink-subtle">atual</span>
                  ) : (
                    <span className="tabular shrink-0 text-xs text-ink-subtle">{target.count}</span>
                  )}
                </button>
              ))}
            </div>
            {absent && (
              <div className="mt-1 border-t border-line pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(absent)}
                  disabled={absent.isCurrent}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-absent transition-colors duration-100 hover:bg-absent/10 focus:bg-absent/10 focus:outline-none disabled:cursor-default disabled:text-ink-subtle disabled:hover:bg-transparent"
                >
                  <span>Ausente</span>
                  {absent.isCurrent ? (
                    <span className="shrink-0 text-[11px] text-ink-subtle">atual</span>
                  ) : (
                    <span className="tabular shrink-0 text-xs">{absent.count}</span>
                  )}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
