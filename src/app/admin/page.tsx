import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AdminPanel } from '@/components/AdminPanel';
import { Footer } from '@/components/Footer';
import type { TechnicianWithCity } from '@/types';
import { requireSessionUser } from '@/lib/session';
import { getTodayDateKey, getUnplannedDayState } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  if (user.role !== 'SUPERVISOR') redirect('/dashboard');

  const regional = user.regional;
  const todayDateKey = getTodayDateKey();

  const [cities, technicians, todayPlans] = await Promise.all([
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
    prisma.technicianDayPlan.findMany({
      where: { dateKey: todayDateKey, technician: { regional } },
      select: { technicianId: true, osField: true, osDelivery: true },
    }),
  ]);

  // A tabela mostra a carga de hoje (a mesma do quadro). O OS gravado no
  // cadastro é só o ponto de partida de dias ainda não planejados.
  const todayPlanLookup = new Map(todayPlans.map((plan) => [plan.technicianId, plan]));
  const adminTechnicians: TechnicianWithCity[] = technicians.map((technician) => {
    // Só a OS vem do dia; lotação e dupla continuam as do cadastro (o padrão).
    const today = todayPlanLookup.get(technician.id) ?? getUnplannedDayState(technician, todayDateKey);
    return { ...technician, osField: today.osField, osDelivery: today.osDelivery };
  });

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
          technicians={adminTechnicians}
          regional={regional}
          todayDateKey={todayDateKey}
        />
      </main>
      <Footer />
    </div>
  );
}
