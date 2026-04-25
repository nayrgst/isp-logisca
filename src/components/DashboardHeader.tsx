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

export function DashboardHeader({ userName, role, regional, isSupervisor }: Props) {
  const pathname = usePathname();

  function getNavClass(href: string) {
    const isActive = pathname === href;
    return `px-3 py-1.5 rounded-lg text-sm transition-colors font-medium ${
      isActive
        ? 'bg-gray-800 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;
  }

  return (
    <header className="h-16 bg-gray-950 border-b border-gray-800 flex items-center px-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 mr-8">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-sm leading-none">ISP Logística</h1>
          <span className="text-gray-500 text-xs">{regional}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        <Link href="/dashboard" className={getNavClass('/dashboard')}>
          Dashboard
        </Link>
        <Link href="/encerramento-os" className={getNavClass('/encerramento-os')}>
          Central de Textos
        </Link>
        {isSupervisor && (
          <Link href="/admin" className={getNavClass('/admin')}>
            Administração
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="text-white text-sm font-medium leading-none">{userName}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {role === 'SUPERVISOR' ? '⭐ Supervisor' : '👤 Operacional'}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          title="Sair"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
