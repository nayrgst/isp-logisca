import type { Regional, Role } from '@prisma/client';

type SessionLike = {
  user?: Record<string, unknown> | null;
} | null;

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  regional: Regional;
};

function isAppSessionUser(
  user: Record<string, unknown> | null | undefined
): user is AppSessionUser {
  return (
    typeof user?.id === 'string' &&
    typeof user?.name === 'string' &&
    typeof user?.email === 'string' &&
    typeof user?.role === 'string' &&
    typeof user?.regional === 'string'
  );
}

export function requireSessionUser(session: SessionLike): AppSessionUser {
  const user = session?.user;
  if (!isAppSessionUser(user)) {
    throw new Error('Não autenticado');
  }

  return user;
}

export function requireSupervisor(session: SessionLike): AppSessionUser {
  const user = requireSessionUser(session);
  if (user.role !== 'SUPERVISOR') {
    throw new Error('Acesso negado');
  }

  return user;
}
