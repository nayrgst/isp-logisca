'use client';

import type { ButtonHTMLAttributes } from 'react';

/* Os botõezinhos do rodapé do card (Escalar/Apoio, Dupla, Operações, chips de
   área) repetiam a mesma string de classes em quatro lugares. */
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: 'neutral' | 'support' | 'area';
}

const activeTones = {
  neutral: 'border-brand/50 bg-brand/10 text-brand-strong',
  support: 'border-support/50 bg-support/10 text-support',
  area: 'border-area/50 bg-area/10 text-area',
};

export function ChipButton({
  active = false,
  tone = 'neutral',
  type = 'button',
  className = '',
  ...props
}: Props) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-control border px-2 py-1 text-[11px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
        active
          ? activeTones[tone]
          : 'border-line-strong text-ink-subtle hover:border-line-strong hover:bg-surface-hover hover:text-ink'
      } ${className}`}
      {...props}
    />
  );
}
