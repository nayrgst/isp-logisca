'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md';

/* `transition-colors` não anima transform nem sombra — por isso a lista explícita:
   é o que faz o botão "afundar" ao clicar em vez de só trocar de cor. */
const base =
  'relative inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out-quart ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-card hover:bg-brand-strong hover:shadow-raised',
  secondary:
    'border border-line-strong bg-surface-raised text-ink-muted hover:bg-surface-hover hover:text-ink',
  outline: 'border border-line-strong text-ink-muted hover:border-brand/60 hover:bg-surface-raised hover:text-ink',
  ghost: 'text-ink-subtle hover:bg-surface-raised hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:border-danger/70 hover:bg-danger/10',
};

const sizes: Record<Size, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {/* O conteúdo perde opacidade em vez de sumir, para o botão não mudar de
          largura enquanto carrega. */}
      <span
        className={`inline-flex items-center gap-2 transition-opacity duration-150 ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {icon}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
