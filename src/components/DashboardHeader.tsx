'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  userName: string;
  role: string;
  regional: string;
  isSupervisor: boolean;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', supervisorOnly: false },
  { href: '/encerramento-os', label: 'Central de Textos', supervisorOnly: false },
  { href: '/admin', label: 'Administração', supervisorOnly: true },
];

export function DashboardHeader({ userName, role, regional, isSupervisor }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.supervisorOnly || isSupervisor);

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-6 border-b border-line bg-canvas/85 px-6 backdrop-blur-md">
      <Link href="/dashboard" className="group flex shrink-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand shadow-card transition-transform duration-200 ease-out-quart group-hover:scale-105">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        </div>
        <div className="leading-none">
          <h1 className="text-sm font-bold text-ink">ISP Logística</h1>
          <span className="text-xs text-ink-subtle">{regional}</span>
        </div>
      </Link>

      <nav className="flex items-center gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative rounded-control px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                isActive ? 'text-ink' : 'text-ink-subtle hover:bg-surface hover:text-ink'
              }`}
            >
              {item.label}
              {/* Sublinhado da aba ativa: cresce a partir do centro em vez de
                  simplesmente aparecer. */}
              <span
                aria-hidden
                className={`absolute inset-x-3 -bottom-px h-0.5 origin-center rounded-full bg-brand transition-transform duration-200 ease-out-quart ${
                  isActive ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="text-right leading-none">
          <p className="text-sm font-medium text-ink">{userName}</p>
          <p className="mt-1 text-xs text-ink-subtle">
            {role === 'SUPERVISOR' ? 'Supervisor' : 'Operacional'}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-control p-2 text-ink-subtle transition-[color,background-color,transform] duration-150 hover:bg-surface hover:text-danger active:scale-95"
          title="Sair"
          aria-label="Sair"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
