import type { ReactNode } from 'react';

/* Antes cada "chip" era estilizado inline no lugar onde aparecia — havia cinco
   combinações diferentes de borda/fundo para o mesmo papel. Aqui viram um tom só. */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'absent'
  | 'support'
  | 'area'
  | 'clt'
  | 'ter';

const tones: Record<BadgeTone, string> = {
  neutral: 'border-line-strong bg-surface-raised text-ink-muted',
  brand: 'border-brand/40 bg-brand/10 text-brand-strong',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  absent: 'border-absent/40 bg-absent/10 text-absent',
  support: 'border-support/40 bg-support/10 text-support',
  area: 'border-area/40 bg-area/10 text-area',
  clt: 'border-os-field/40 bg-os-field/10 text-os-field',
  ter: 'border-absent/40 bg-absent/10 text-absent',
};

interface Props {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = 'neutral', children, className = '', title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
