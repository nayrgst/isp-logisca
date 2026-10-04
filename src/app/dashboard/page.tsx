import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Regional } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardHeader } from '@/components/DashboardHeader';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Footer } from '@/components/Footer';
import { requireSessionUser } from '@/lib/session';
import { getTodayDateKey, getUnplannedDayState, normalizeSelectedDate } from '@/lib/schedule';
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
    enabled: true,
    selectedDate,
    todayDate,
    isEditable: true,
  };

  const [cities, technicians, dayPlans] = await Promise.all([
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
            technician: { regional: { in: accessibleRegionals } },
          },
        })
      : Promise.resolve([]),
  ]);

  const cityLookup = new Map(cities.map((city) => [city.id, city]));
  const planLookup = new Map(dayPlans.map((plan) => [plan.technicianId, plan]));

  const mergedTechnicians: TechnicianWithCity[] = technicians.map((technician) => {
    const shouldUsePlan = dailySchedule.enabled;
    const plan = shouldUsePlan ? planLookup.get(technician.id) : undefined;
    // Com plano, o plano manda — inclusive "sem dupla" (null). Sem plano, vale o
    // estado inicial do dia: o cadastro, ou todos em Ausente no domingo.
    const dayState = plan ?? getUnplannedDayState(technician, selectedDate);
    // Cidade que não existe mais (apagada) deixaria o técnico fora de todas as
    // colunas; nesse caso ele aparece nos ausentes para poder ser realocado.
    const resolvedCityId =
      dayState.cityId && cityLookup.has(dayState.cityId) ? dayState.cityId : null;
    const resolvedSupportCityId = dayState.supportCityId;
    const resolvedOnLeave = dayState.onLeave || !resolvedCityId;

    return {
      ...technician,
      cityId: resolvedOnLeave ? null : resolvedCityId,
      supportCityId: resolvedSupportCityId ?? null,
      osField: dayState.osField,
      osDelivery: dayState.osDelivery,
      osPickup: dayState.osPickup,
      osDoorRelease: dayState.osDoorRelease,
      osInternal: dayState.osInternal,
      onLeave: resolvedOnLeave,
      absenceReason: technician.absenceReason,
      // Global igual ao motivo de ausência: o vínculo com a sub-área da Área
      // Verde persiste em todas as datas até trocarem ou ele sair da área.
      areas: technician.areas,
      onPickup: dayState.onPickup,
      order: plan?.order ?? technician.order,
      sharedCellId: dayState.sharedCellId,
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
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <DashboardHeader
        userName={user.name}
        role={user.role}
        regional={headerRegional}
        isSupervisor={isSupervisor}
      />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard cities={boardCities} isSupervisor={isSupervisor} dailySchedule={dailySchedule} />
      </main>
      <Footer compact />
    </div>
  );
}
