'use client';

import { GREEN_AREAS, summarizeGreenAreas } from '@/lib/greenAreas';
import { Badge } from '@/components/ui/Badge';

interface Props {
  selected: string[];
  onToggle: (area: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

/* Seleção das sub-áreas da Área Verde (só DF02).
   Duas colunas em vez de chips que quebram linha: cabe no card de 280px sem
   fazer o rodapé pular de altura conforme o texto selecionado, e cada alvo
   fica grande o suficiente para clicar. */
export function GreenAreaPicker({ selected, onToggle, onClear, disabled = false }: Props) {
  const count = selected.length;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
          title="A área fica vinculada ao técnico em todas as datas até alguém trocar ou ele sair da Área Verde."
        >
          Áreas
        </span>
        <Badge tone={count > 0 ? 'area' : 'neutral'}>{summarizeGreenAreas(selected)}</Badge>
        {count > 0 && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded px-1 text-[10px] text-ink-subtle transition-colors duration-150 hover:text-danger"
            title="Remover todas as áreas deste técnico"
          >
            limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        {GREEN_AREAS.map((area) => {
          const active = selected.includes(area.value);
          return (
            <button
              key={area.value}
              type="button"
              onClick={() => onToggle(area.value)}
              disabled={disabled}
              aria-pressed={active}
              title={area.value}
              className={`flex items-center gap-1.5 rounded-control border px-2 py-1.5 text-[11px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
                active
                  ? 'border-area/60 bg-area/12 text-area'
                  : 'border-line-strong text-ink-subtle hover:border-area/40 hover:bg-area/6 hover:text-ink'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-150 ${
                  active ? 'border-area bg-area' : 'border-line-strong'
                }`}
              >
                {active && (
                  <svg
                    className="h-2.5 w-2.5 animate-pop text-canvas"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={4}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="truncate">{area.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
