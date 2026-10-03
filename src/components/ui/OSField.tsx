'use client';

import { OS_VISUALS, type OSVisualKey } from '@/lib/osVisuals';

/* Campo de OS (− valor +) e checkbox de operação, usados pelo card individual
   e pelo card da dupla. Antes a dupla tinha uma cópia própria com cores
   fixas, que já tinha divergido das cores por tipo de OS. */

interface OSFieldProps {
  label: string;
  value: number;
  readOnly: boolean;
  isEditing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (value: number) => void;
  onDoubleClick: () => void;
  onBlur: (value: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onStep: (delta: number) => void;
  color: OSVisualKey;
}

export function OSField({
  label,
  value,
  readOnly,
  isEditing,
  inputRef,
  onChange,
  onDoubleClick,
  onBlur,
  onKeyDown,
  onStep,
  color,
}: OSFieldProps) {
  const visual = OS_VISUALS[color];

  return (
    // `@container`: em colunas estreitas (com barra de rolagem, ou o grid de 2
    // na dupla) o sufixo "OS" some em vez de quebrar linha ou encostar no "+".
    <div className={`@container rounded-control border ${visual.surface} ${visual.border} px-3 py-2`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${visual.solid}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </span>
      </div>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Math.max(0, parseInt(event.target.value, 10) || 0))}
          onBlur={() => onBlur(value)}
          onKeyDown={onKeyDown}
          aria-label={`${label}: quantidade de OS`}
          className={`tabular w-full border-b border-current bg-transparent text-lg font-bold ${visual.text} focus:outline-none`}
          autoFocus
        />
      ) : (
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={readOnly || value <= 0}
            aria-label={`Diminuir ${label}`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control border text-base leading-none transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-25 ${visual.border} ${visual.text} hover:bg-white/10`}
          >
            −
          </button>
          <button
            type="button"
            onDoubleClick={onDoubleClick}
            title={readOnly ? 'Dia bloqueado para edição' : 'Clique duas vezes para digitar um valor'}
            className={`tabular min-w-0 whitespace-nowrap text-lg font-bold ${visual.text}`}
          >
            {/* A key remonta o número a cada mudança, o que reinicia a animação:
                sem isso, incrementar pelo stepper não dava retorno visual. */}
            <span key={value} className="inline-block animate-bump">
              {value}
            </span>
            <span className="ml-1 hidden text-xs font-normal text-ink-subtle @min-[8.5rem]:inline">
              OS
            </span>
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={readOnly}
            aria-label={`Aumentar ${label}`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control border text-base leading-none transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-25 ${visual.border} ${visual.text} hover:bg-white/10`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export function OperationCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface/70 px-2 py-1.5 text-[11px] text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-line-strong bg-canvas accent-brand"
      />
      <span>{label}</span>
    </label>
  );
}
