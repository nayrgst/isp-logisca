import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { KanbanBoard } from '@/components/KanbanBoard';
import { DashboardHeader } from '@/components/DashboardHeader';
import { requireSessionUser } from '@/lib/session';
import type { CityWithTechnicians } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  const regional = user.regional;
  const isSupervisor = user.role === 'SUPERVISOR';

  // Fetch cities with technicians for the user's regional
  const cities: CityWithTechnicians[] = await prisma.city.findMany({
    where: { regional },
    orderBy: { order: 'asc' },
    include: {
      technicians: {
        where: { onLeave: false },
        orderBy: { name: 'asc' },
        include: { city: true },
      },
    },
  });

  const leaveTechnicians = await prisma.technician.findMany({
    where: { regional, onLeave: true },
    orderBy: { name: 'asc' },
    include: { city: true },
  });

  const boardCities: CityWithTechnicians[] = [
    ...cities,
    {
      id: '__UNASSIGNED__',
      name: 'Folga ou férias',
      regional,
      order: cities.length,
      isVirtual: true,
      technicians: leaveTechnicians,
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <DashboardHeader
        userName={user.name}
        role={user.role}
        regional={regional}
        isSupervisor={isSupervisor}
      />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard
          key={JSON.stringify(
            cities.map((city) => ({
              id: city.id,
              technicians: city.technicians.map((technician) => ({
                id: technician.id,
                cityId: technician.cityId,
                canField: technician.canField,
                canDelivery: technician.canDelivery,
                canPickup: technician.canPickup,
                canDoorRelease: technician.canDoorRelease,
                osField: technician.osField,
                osDelivery: technician.osDelivery,
                osPickup: technician.osPickup,
                osDoorRelease: technician.osDoorRelease,
                osLimit: technician.osLimit,
                onLeave: technician.onLeave,
                onPickup: technician.onPickup,
              })),
            }))
          )}
          cities={boardCities}
          isSupervisor={isSupervisor}
        />
      </main>
    </div>
  );
}
