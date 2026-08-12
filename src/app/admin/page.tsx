import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AdminPanel } from '@/components/AdminPanel';
import { Footer } from '@/components/Footer';
import type { TechnicianWithCity } from '@/types';
import { requireSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  if (user.role !== 'SUPERVISOR') redirect('/dashboard');

  const regional = user.regional;

  const [cities, technicians] = await Promise.all([
    prisma.city.findMany({
      where: { regional },
      orderBy: { order: 'asc' },
      include: { _count: { select: { technicians: true } } },
    }),
    prisma.technician.findMany({
      where: { regional },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { city: true, supportCity: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DashboardHeader
        userName={user.name ?? 'Usuário'}
        role={user.role}
        regional={regional}
        isSupervisor={true}
      />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <AdminPanel
          cities={cities}
          technicians={technicians as TechnicianWithCity[]}
          regional={regional}
        />
      </main>
      <Footer />
    </div>
  );
}
