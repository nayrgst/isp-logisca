'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard',
      redirect: false,
    });

    if (result?.error || !result?.ok) {
      setError('Email ou senha inválidos');
      setLoading(false);
    } else {
      router.push(result.url ?? '/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      {/* Halo de marca: dá profundidade ao fundo chapado sem competir com o card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/12 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 translate-y-1/3 rounded-full bg-os-door/8 blur-3xl"
      />

      <div className="relative w-full max-w-md animate-rise">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-panel bg-brand shadow-raised">
            <svg
              className="h-9 w-9 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">ISP Logística</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestão de Equipes Técnicas</p>
        </div>

        <div className="rounded-panel border border-line bg-surface p-8 shadow-popover">
          <h2 className="mb-6 text-lg font-semibold text-ink">Entrar no sistema</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-ink-muted">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full rounded-control border border-line-strong bg-surface-raised px-4 py-2.5 text-ink placeholder-ink-subtle transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-soft)] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink-muted">
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-control border border-line-strong bg-surface-raised px-4 py-2.5 text-ink placeholder-ink-subtle transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-soft)] focus:outline-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="animate-pop rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="mt-2 w-full">
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-subtle">Regional DF02 · Regional DF03</p>
        <p className="mt-2 text-center text-xs text-ink-subtle">
          © {new Date().getFullYear()} nayrgst. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
