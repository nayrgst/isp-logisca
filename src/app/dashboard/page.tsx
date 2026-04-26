import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { KanbanBoard } from '@/components/KanbanBoard';
import { DashboardHeader } from '@/components/DashboardHeader';
import { requireSessionUser } from '@/lib/session';
import type { CityWithTechnicians } from '@/types';
import { Regional } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  const isSupervisor = user.role === 'SUPERVISOR';
  const accessibleRegionals = isSupervisor ? [user.regional] : [Regional.DF02, Regional.DF03];
  const headerRegional = isSupervisor ? user.regional : 'DF02 + DF03';

  const cities: CityWithTechnicians[] = await prisma.city.findMany({
    where: { regional: { in: accessibleRegionals } },
    orderBy: [{ regional: 'asc' }, { order: 'asc' }],
    include: {
      technicians: {
        where: { onLeave: false },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { city: true, supportCity: true },
      },
    },
  });

  const leaveTechnicians = await prisma.technician.findMany({
    where: { regional: { in: accessibleRegionals }, onLeave: true },
    orderBy: [{ regional: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    include: { city: true, supportCity: true },
  });

  const boardCities: CityWithTechnicians[] = accessibleRegionals.flatMap((regional) => {
    const regionalCities = cities.map((city) => {
      if (city.regional !== regional) return null;
      return {
        ...city,
        name: isSupervisor ? city.name : `${city.name} · ${city.regional}`,
      };
    }).filter(Boolean) as CityWithTechnicians[];

    return [
      ...regionalCities,
      {
        id: `__UNASSIGNED__-${regional}`,
        name: isSupervisor ? 'Ausente' : `Ausente · ${regional}`,
        regional,
        order: regionalCities.length,
        isVirtual: true,
        technicians: leaveTechnicians.filter((technician) => technician.regional === regional),
      },
    ];
  });

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <DashboardHeader
        userName={user.name}
        role={user.role}
        regional={headerRegional}
        isSupervisor={isSupervisor}
      />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard cities={boardCities} isSupervisor={isSupervisor} />
      </main>
    </div>
  );
}
