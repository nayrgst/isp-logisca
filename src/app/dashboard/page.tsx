import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Regional } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardHeader } from '@/components/DashboardHeader';
import { KanbanBoard } from '@/components/KanbanBoard';
import { requireSessionUser } from '@/lib/session';
import { getTodayDateKey, getWeekOptions, isEditableScheduleDate, normalizeSelectedDate } from '@/lib/schedule';
import type { CityWithTechnicians, DailyScheduleConfig, TechnicianWithCity } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  const isSupervisor = user.role === 'SUPERVISOR';
  const accessibleRegionals = isSupervisor ? [user.regional] : [Regional.DF02, Regional.DF03];
  const headerRegional = isSupervisor ? user.regional : 'DF02 + DF03';
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawSelectedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;

  const todayDate = getTodayDateKey();
  const selectedDate = normalizeSelectedDate(rawSelectedDate, todayDate);
  const dailySchedule: DailyScheduleConfig = {
    enabled: accessibleRegionals.includes(Regional.DF02),
    selectedDate,
    todayDate,
    isEditable: isEditableScheduleDate(selectedDate, todayDate),
    appliesToRegional: Regional.DF02,
    options: getWeekOptions(todayDate),
  };

  const [cities, technicians, df02Plans] = await Promise.all([
    prisma.city.findMany({
      where: { regional: { in: accessibleRegionals } },
      orderBy: [{ regional: 'asc' }, { order: 'asc' }],
    }),
    prisma.technician.findMany({
      where: { regional: { in: accessibleRegionals } },
      orderBy: [{ regional: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      include: { city: true, supportCity: true },
    }),
    dailySchedule.enabled
      ? prisma.technicianDayPlan.findMany({
          where: {
            dateKey: selectedDate,
            technician: { regional: Regional.DF02 },
          },
        })
      : Promise.resolve([]),
  ]);

  const cityLookup = new Map(cities.map((city) => [city.id, city]));
  const planLookup = new Map(df02Plans.map((plan) => [plan.technicianId, plan]));

  const mergedTechnicians: TechnicianWithCity[] = technicians.map((technician) => {
    const shouldUsePlan = dailySchedule.enabled && technician.regional === Regional.DF02;
    const plan = shouldUsePlan ? planLookup.get(technician.id) : undefined;
    const resolvedCityId = plan ? plan.cityId : technician.cityId;
    const resolvedSupportCityId = plan ? plan.supportCityId : technician.supportCityId;
    const resolvedOnLeave = plan ? plan.onLeave : technician.onLeave;

    return {
      ...technician,
      cityId: resolvedOnLeave ? null : resolvedCityId,
      supportCityId: resolvedSupportCityId ?? null,
      osField: plan?.osField ?? technician.osField,
      osDelivery: plan?.osDelivery ?? technician.osDelivery,
      osPickup: plan?.osPickup ?? technician.osPickup,
      osDoorRelease: plan?.osDoorRelease ?? technician.osDoorRelease,
      onLeave: resolvedOnLeave,
      onPickup: plan?.onPickup ?? technician.onPickup,
      order: plan?.order ?? technician.order,
      sharedCellId: plan?.sharedCellId ?? technician.sharedCellId,
      city:
        resolvedOnLeave || !resolvedCityId
          ? null
          : cityLookup.get(resolvedCityId)
            ? {
                id: resolvedCityId,
                name: cityLookup.get(resolvedCityId)!.name,
                regional: cityLookup.get(resolvedCityId)!.regional,
              }
            : null,
      supportCity: resolvedSupportCityId
        ? cityLookup.get(resolvedSupportCityId)
          ? {
              id: resolvedSupportCityId,
              name: cityLookup.get(resolvedSupportCityId)!.name,
              regional: cityLookup.get(resolvedSupportCityId)!.regional,
            }
          : null
        : null,
    };
  });

  const boardCities: CityWithTechnicians[] = accessibleRegionals.flatMap((regional) => {
    const regionalCities = cities
      .filter((city) => city.regional === regional)
      .map((city) => ({
        ...city,
        name: isSupervisor ? city.name : `${city.name} · ${city.regional}`,
        technicians: mergedTechnicians.filter(
          (technician) => technician.regional === regional && !technician.onLeave && technician.cityId === city.id
        ),
      }));

    return [
      ...regionalCities,
      {
        id: `__UNASSIGNED__-${regional}`,
        name: isSupervisor ? 'Ausente' : `Ausente · ${regional}`,
        regional,
        order: regionalCities.length,
        isVirtual: true,
        technicians: mergedTechnicians.filter(
          (technician) => technician.regional === regional && technician.onLeave
        ),
      },
    ];
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950">
      <DashboardHeader
        userName={user.name}
        role={user.role}
        regional={headerRegional}
        isSupervisor={isSupervisor}
      />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard cities={boardCities} isSupervisor={isSupervisor} dailySchedule={dailySchedule} />
      </main>
    </div>
  );
}
