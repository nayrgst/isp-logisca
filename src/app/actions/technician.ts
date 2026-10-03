'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { Prisma, Regional, TechnicianType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireSessionUser, requireSupervisor } from '@/lib/session';
import { isValidDateKey, shouldUseDailySchedule } from '@/lib/schedule';
import { createInternalTechnicianCode } from '@/lib/technician';
import { getSupportRestrictionReason } from '@/lib/support';
import { isAbsenceReason } from '@/lib/absence';
import { isGreenAreaCityName, isGreenAreaValue } from '@/lib/greenAreas';
import { getCellOperations } from '@/lib/board';
import type { RegionalView } from '@/types';

function getAccessibleRegionals(user: { role: 'SUPERVISOR' | 'OPERATIONAL'; regional: Regional }) {
  return user.role === 'SUPERVISOR' ? [user.regional] : [Regional.DF02, Regional.DF03];
}

async function getAccessibleTechnician(technicianId: string, regionals: Regional[]) {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, regional: { in: regionals } },
  });

  if (!technician) {
    throw new Error('Técnico não encontrado nas regionais permitidas');
  }

  return technician;
}

async function getRegionalCity(cityId: string, regional: Regional) {
  const city = await prisma.city.findFirst({
    where: { id: cityId, regional },
  });

  if (!city) {
    throw new Error('Cidade não encontrada na regional do técnico');
  }

  return city;
}

async function getSupportCityForTechnician(
  cityId: string,
  regional: Regional,
  technicianName: string,
  technicianType: TechnicianType
) {
  const city = await getRegionalCity(cityId, regional);
  const restrictionReason = getSupportRestrictionReason({
    technicianName,
    supportCityName: city.name,
    regional,
    technicianType,
  });

  if (restrictionReason) {
    throw new Error(restrictionReason);
  }

  return city;
}

async function getNextTechnicianOrder(regional: Regional, cityId: string | null) {
  const aggregate = await prisma.technician.aggregate({
    where: {
      regional,
      cityId,
      onLeave: cityId === null,
    },
    _max: { order: true },
  });

  return (aggregate._max.order ?? -1) + 1;
}

async function cleanupSharedCell(sharedCellId: string | null | undefined) {
  if (!sharedCellId) return;

  const remaining = await prisma.technician.findMany({
    where: { sharedCellId },
    select: { id: true },
  });

  if (remaining.length <= 1) {
    await prisma.technician.updateMany({
      where: { sharedCellId },
      data: { sharedCellId: null },
    });
  }
}

async function getTechnicianGroupMembers(technician: { id: string; sharedCellId: string | null }) {
  if (!technician.sharedCellId) {
    return prisma.technician.findMany({
      where: { id: technician.id },
    });
  }

  return prisma.technician.findMany({
    where: { sharedCellId: technician.sharedCellId },
  });
}

function mergeTechnicianWithPlan<
  T extends {
    id: string;
    cityId: string | null;
    supportCityId: string | null;
    osField: number;
    osDelivery: number;
    osPickup: number;
    osDoorRelease: number;
    osInternal: number;
    onLeave: boolean;
    absenceReason: string | null;
    areas: string[];
    onPickup: boolean;
    order: number;
    sharedCellId: string | null;
  },
>(
  technician: T,
  plan: {
    cityId: string | null;
    supportCityId: string | null;
    osField: number;
    osDelivery: number;
    osPickup: number;
    osDoorRelease: number;
    osInternal: number;
    onLeave: boolean;
    absenceReason: string | null;
    areas: string[];
    onPickup: boolean;
    order: number;
    sharedCellId: string | null;
  } | null
) {
  if (!plan) return technician;

  return {
    ...technician,
    cityId: plan.cityId,
    supportCityId: plan.supportCityId,
    osField: plan.osField,
    osDelivery: plan.osDelivery,
    osPickup: plan.osPickup,
    osDoorRelease: plan.osDoorRelease,
    osInternal: plan.osInternal,
    onLeave: plan.onLeave,
    // absenceReason e areas são globais do técnico: o day plan não os sobrepõe.
    absenceReason: technician.absenceReason,
    areas: technician.areas,
    onPickup: plan.onPickup,
    order: plan.order,
    sharedCellId: plan.sharedCellId,
  };
}

async function getTechnicianGroupMembersForSchedule(
  technician: Awaited<ReturnType<typeof getAccessibleTechnician>>,
  scheduleDate?: string | null
) {
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (!editableScheduleDate || !shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    return getTechnicianGroupMembers(technician);
  }

  const technicianPlan = await prisma.technicianDayPlan.findUnique({
    where: {
      technicianId_dateKey: {
        technicianId: technician.id,
        dateKey: editableScheduleDate,
      },
    },
  });
  // Com plano no dia, o plano manda — inclusive quando ele diz "sem dupla"
  // (null). Usar `??` aqui ressuscitava a dupla antiga do cadastro.
  const effectiveSharedCellId = technicianPlan
    ? technicianPlan.sharedCellId
    : technician.sharedCellId;

  const members = effectiveSharedCellId
    ? await prisma.technician.findMany({
        where: {
          OR: [
            { sharedCellId: effectiveSharedCellId },
            {
              dayPlans: {
                some: {
                  dateKey: editableScheduleDate,
                  sharedCellId: effectiveSharedCellId,
                },
              },
            },
          ],
        },
      })
    : await prisma.technician.findMany({
        where: { id: technician.id },
      });

  const plans = await prisma.technicianDayPlan.findMany({
    where: {
      technicianId: { in: members.map((member) => member.id) },
      dateKey: editableScheduleDate,
    },
  });
  const planMap = new Map(plans.map((plan) => [plan.technicianId, plan]));

  // A busca acima também traz quem tem a dupla só no cadastro mas já a desfez
  // no plano do dia; depois de aplicar o plano, só fica quem é da dupla hoje.
  return members
    .map((member) => mergeTechnicianWithPlan(member, planMap.get(member.id) ?? null))
    .filter(
      (member) => member.id === technician.id || member.sharedCellId === effectiveSharedCellId
    );
}

// Versão por data do cleanupSharedCell: se uma dupla ficou com um membro só
// naquele dia, desfaz o "grupo de um" no plano do dia.
async function cleanupDailySharedCell(sharedCellId: string | null | undefined, dateKey: string) {
  if (!sharedCellId) return;

  const candidates = await prisma.technician.findMany({
    where: {
      OR: [
        { sharedCellId },
        { dayPlans: { some: { dateKey, sharedCellId } } },
      ],
    },
    include: { dayPlans: { where: { dateKey } } },
  });

  const remaining = candidates.filter((candidate) => {
    const plan = candidate.dayPlans[0];
    return (plan ? plan.sharedCellId : candidate.sharedCellId) === sharedCellId;
  });

  if (remaining.length > 1) return;

  await prisma.$transaction(
    remaining.map((member) =>
      prisma.technicianDayPlan.upsert({
        where: { technicianId_dateKey: { technicianId: member.id, dateKey } },
        create: {
          technicianId: member.id,
          dateKey,
          ...buildDayPlanSeed(member),
          sharedCellId: null,
        },
        update: { sharedCellId: null },
      })
    )
  );
}

// Uma data malformada não pode cair silenciosamente no modo "sem data" (que
// grava direto no cadastro do técnico e muda todos os dias sem planejamento).
function validateEditableScheduleDate(scheduleDate?: string | null) {
  if (!scheduleDate) return null;

  if (!isValidDateKey(scheduleDate)) {
    throw new Error('Data da escala inválida');
  }

  return scheduleDate;
}

function buildDayPlanSeed(technician: {
  cityId: string | null;
  supportCityId: string | null;
  osField: number;
  osDelivery: number;
  osPickup: number;
  osDoorRelease: number;
  osInternal: number;
  onLeave: boolean;
  absenceReason: string | null;
  areas: string[];
  onPickup: boolean;
  order: number;
  sharedCellId: string | null;
}) {
  return {
    cityId: technician.cityId,
    supportCityId: technician.supportCityId,
    osField: technician.osField,
    osDelivery: technician.osDelivery,
    osPickup: technician.osPickup,
    osDoorRelease: technician.osDoorRelease,
    osInternal: technician.osInternal,
    onLeave: technician.onLeave,
    absenceReason: technician.absenceReason,
    areas: technician.areas,
    onPickup: technician.onPickup,
    order: technician.order,
    sharedCellId: technician.sharedCellId,
  };
}

async function getTechnicianPlanSnapshot(
  technician: Awaited<ReturnType<typeof getAccessibleTechnician>>,
  scheduleDate?: string | null
) {
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);
  if (!editableScheduleDate || !shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    return technician;
  }

  const plan = await prisma.technicianDayPlan.findUnique({
    where: {
      technicianId_dateKey: {
        technicianId: technician.id,
        dateKey: editableScheduleDate,
      },
    },
  });

  return mergeTechnicianWithPlan(technician, plan);
}

async function upsertTechnicianDayPlan(
  technician: Awaited<ReturnType<typeof getAccessibleTechnician>>,
  scheduleDate: string,
  data: Partial<ReturnType<typeof buildDayPlanSeed>>
) {
  return prisma.technicianDayPlan.upsert({
    where: {
      technicianId_dateKey: {
        technicianId: technician.id,
        dateKey: scheduleDate,
      },
    },
    create: {
      technicianId: technician.id,
      dateKey: scheduleDate,
      ...buildDayPlanSeed(technician),
      ...data,
    },
    update: data,
  });
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function revalidateTechnicianViews() {
  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

export async function updateTechnicianAbsenceReason(technicianId: string, reason: string | null) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);

  const normalizedReason = reason && isAbsenceReason(reason) ? reason : null;

  // O motivo é um atributo global do técnico: persiste em todas as datas até
  // ser alterado ou até o técnico sair dos ausentes (ver persistTechnicianLayout).
  await prisma.technician.update({
    where: { id: technician.id },
    data: { absenceReason: normalizedReason },
  });

  revalidateTechnicianViews();
}

// Dupla que está nos ausentes: o motivo vale para os dois membros.
export async function updateTechnicianGroupAbsenceReason(
  technicianId: string,
  reason: string | null,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicians = await getTechnicianGroupMembersForSchedule(technician, scheduleDate);

  const normalizedReason = reason && isAbsenceReason(reason) ? reason : null;

  await prisma.technician.updateMany({
    where: { id: { in: technicians.map((member) => member.id) } },
    data: { absenceReason: normalizedReason },
  });

  revalidateTechnicianViews();
}

// Sem `scheduleDate`: a área não é mais por data.
export async function updateTechnicianAreas(technicianId: string, areas: string[]) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  await getAccessibleTechnician(technicianId, accessibleRegionals);

  const normalizedAreas = Array.from(new Set(areas.filter(isGreenAreaValue)));

  // A área é um atributo global do técnico: o vínculo persiste em todas as
  // datas até alguém trocar ou até ele sair da Área Verde (ver
  // persistTechnicianLayout).
  await prisma.technician.update({
    where: { id: technicianId },
    data: { areas: normalizedAreas },
  });

  revalidateTechnicianViews();
}

// Sem `scheduleDate` pelo mesmo motivo do caso individual; a dupla ainda é
// resolvida pela data, porque a composição da dupla continua sendo por dia.
export async function updateTechnicianGroupAreas(
  technicianId: string,
  areas: string[],
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicians = await getTechnicianGroupMembersForSchedule(technician, scheduleDate);

  const normalizedAreas = Array.from(new Set(areas.filter(isGreenAreaValue)));

  // Global, igual ao caso individual acima.
  await prisma.technician.updateMany({
    where: { id: { in: technicians.map((member) => member.id) } },
    data: { areas: normalizedAreas },
  });

  revalidateTechnicianViews();
}

export async function persistTechnicianLayout(
  updates: Array<{ id: string; cityId: string | null; order: number }>,
  scheduleDate?: string | null
) {
  if (updates.length === 0) return;

  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const uniqueUpdates = Array.from(new Map(updates.map((update) => [update.id, update])).values());
  const technicianIds = uniqueUpdates.map((update) => update.id);

  const technicians = await prisma.technician.findMany({
    where: {
      id: { in: technicianIds },
      regional: { in: accessibleRegionals },
    },
    select: {
      id: true,
      regional: true,
      cityId: true,
      supportCityId: true,
      osField: true,
      osDelivery: true,
      osPickup: true,
      osDoorRelease: true,
      osInternal: true,
      onLeave: true,
      absenceReason: true,
      areas: true,
      onPickup: true,
      order: true,
      sharedCellId: true,
    },
  });

  if (technicians.length !== technicianIds.length) {
    throw new Error('Nem todos os técnicos podem ser atualizados por esse usuário');
  }

  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  // No modo por data, o estado "de antes" de cada técnico é o do plano do dia
  // (apoio, ausência, cidade), não o do cadastro. Sem isso, arrastar um card
  // sobrescrevia o apoio escalado só para aquele dia com o valor do cadastro.
  const plans = editableScheduleDate
    ? await prisma.technicianDayPlan.findMany({
        where: { technicianId: { in: technicianIds }, dateKey: editableScheduleDate },
      })
    : [];
  const planMap = new Map(plans.map((plan) => [plan.technicianId, plan]));
  const technicianMap = new Map(
    technicians.map((technician) => [
      technician.id,
      editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)
        ? mergeTechnicianWithPlan(technician, planMap.get(technician.id) ?? null)
        : technician,
    ])
  );
  const cityIds = Array.from(
    new Set(
      [
        ...uniqueUpdates.map((update) => update.cityId),
        ...Array.from(technicianMap.values()).map((technician) => technician.cityId),
      ].filter((cityId): cityId is string => Boolean(cityId))
    )
  );
  const cities = cityIds.length
    ? await prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, regional: true, name: true },
      })
    : [];
  const cityMap = new Map(cities.map((city) => [city.id, city]));

  for (const update of uniqueUpdates) {
    const technician = technicianMap.get(update.id);
    if (!technician) {
      throw new Error('Técnico não encontrado');
    }

    if (update.cityId) {
      const city = cityMap.get(update.cityId);
      if (!city || city.regional !== technician.regional) {
        throw new Error('A movimentação entre regionais não é permitida');
      }
    }
  }

  await prisma.$transaction(
    uniqueUpdates.map((update) => {
      const technician = technicianMap.get(update.id)!;
      const supportCityId =
        update.cityId === null || technician.supportCityId === update.cityId
          ? null
          : technician.supportCityId;

      if (
        editableScheduleDate &&
        shouldUseDailySchedule(technician.regional, editableScheduleDate)
      ) {
        return prisma.technicianDayPlan.upsert({
          where: {
            technicianId_dateKey: {
              technicianId: update.id,
              dateKey: editableScheduleDate,
            },
          },
          create: {
            technicianId: update.id,
            dateKey: editableScheduleDate,
            ...buildDayPlanSeed({
              ...technician,
              cityId: update.cityId,
              supportCityId,
              onLeave: update.cityId === null,
              onPickup: false,
              order: Math.max(0, update.order),
            }),
          },
          update: {
            cityId: update.cityId,
            onLeave: update.cityId === null,
            onPickup: false,
            order: Math.max(0, update.order),
            supportCityId,
          },
        });
      }

      return prisma.technician.update({
        where: { id: update.id },
        data: {
          cityId: update.cityId,
          onLeave: update.cityId === null,
          onPickup: false,
          order: Math.max(0, update.order),
          supportCityId:
            update.cityId === null || technician.supportCityId === update.cityId ? null : undefined,
        },
      });
    })
  );

  // Motivo de ausência é global: limpa só para quem estava ausente e foi
  // arrastado para uma cidade. Reordenar uma coluna manda todos os técnicos
  // dela, e isso não pode apagar o motivo de quem está ausente em outra data.
  const returnedToCityIds = uniqueUpdates
    .filter((update) => {
      const technician = technicianMap.get(update.id);
      return update.cityId !== null && technician?.onLeave && technician.absenceReason;
    })
    .map((update) => update.id);
  if (returnedToCityIds.length > 0) {
    await prisma.technician.updateMany({
      where: { id: { in: returnedToCityIds } },
      data: { absenceReason: null },
    });
  }

  // Área é global: limpa só para quem saiu da Área Verde nesta movimentação,
  // pelo mesmo motivo acima.
  const leftGreenAreaIds = uniqueUpdates
    .filter((update) => {
      const technician = technicianMap.get(update.id);
      if (!technician || technician.areas.length === 0) return false;
      const origin = technician.cityId ? cityMap.get(technician.cityId) : null;
      const destination = update.cityId ? cityMap.get(update.cityId) : null;
      return isGreenAreaCityName(origin?.name) && !isGreenAreaCityName(destination?.name);
    })
    .map((update) => update.id);
  if (leftGreenAreaIds.length > 0) {
    await prisma.technician.updateMany({
      where: { id: { in: leftGreenAreaIds } },
      data: { areas: [] },
    });
  }

  revalidateTechnicianViews();
}

export async function updateTechnicianOS(
  technicianId: string,
  field: 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease' | 'osInternal',
  value: number,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);

  if (field === 'osField' && !technician.canField) {
    throw new Error('Esse técnico não possui operação Field');
  }

  if (field === 'osDelivery' && !technician.canDelivery) {
    throw new Error('Esse técnico não possui operação Delivery');
  }

  if (field === 'osPickup' && !technician.canPickup) {
    throw new Error('Esse técnico não possui operação Retirada');
  }

  if (field === 'osInternal' && !technician.canInternal) {
    throw new Error('Esse técnico não possui operação Interno');
  }

  if (field === 'osDoorRelease' && !technician.canDoorRelease) {
    throw new Error('Esse técnico não possui operação Liberação de porta');
  }

  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    await upsertTechnicianDayPlan(technician, editableScheduleDate, {
      [field]: Math.max(0, value),
    });
  } else {
    await prisma.technician.update({
      where: { id: technicianId },
      data: { [field]: Math.max(0, value) },
    });
  }

  revalidatePath('/dashboard');
}

export async function updateTechnicianGroupOS(
  technicianId: string,
  field: 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease' | 'osInternal',
  value: number,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicians = await getTechnicianGroupMembersForSchedule(technician, scheduleDate);

  // A dupla atende a operação se pelo menos um dos membros a possui (ex.: um
  // técnico Field com outro só Delivery). Exigir de todos bloqueava a OS Field
  // nessas duplas mistas. Mesma regra de getCellOperations no cliente.
  const operations = getCellOperations(technicians);

  if (field === 'osField' && !operations.canField) {
    throw new Error('Nenhum técnico da dupla possui operação Field');
  }

  if (field === 'osDelivery' && !operations.canDelivery) {
    throw new Error('Nenhum técnico da dupla possui operação Delivery');
  }

  if (field === 'osPickup' && !operations.canPickup) {
    throw new Error('Nenhum técnico da dupla possui operação Retirada');
  }

  if (field === 'osInternal' && !operations.canInternal) {
    throw new Error('Nenhum técnico da dupla possui operação Interno');
  }

  if (field === 'osDoorRelease' && !operations.canDoorRelease) {
    throw new Error('Nenhum técnico da dupla possui operação Liberação de porta');
  }

  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    await prisma.$transaction(
      technicians.map((member) =>
        prisma.technicianDayPlan.upsert({
          where: {
            technicianId_dateKey: {
              technicianId: member.id,
              dateKey: editableScheduleDate,
            },
          },
          create: {
            technicianId: member.id,
            dateKey: editableScheduleDate,
            ...buildDayPlanSeed(member),
            [field]: Math.max(0, value),
          },
          update: { [field]: Math.max(0, value) },
        })
      )
    );
  } else {
    await prisma.technician.updateMany({
      where: {
        id: {
          in: technicians.map((member) => member.id),
        },
      },
      data: { [field]: Math.max(0, value) },
    });
  }

  revalidatePath('/dashboard');
}

export async function createTechnician(data: {
  code?: string;
  name: string;
  type: TechnicianType;
  osLimit: number;
  cityId?: string;
  canField: boolean;
  canDelivery: boolean;
  canPickup: boolean;
  canDoorRelease: boolean;
  canInternal: boolean;
  onLeave?: boolean;
}) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);
  const normalizedName = data.name?.trim();
  const normalizedCode = data.code?.trim();
  const normalizedCityId = data.cityId?.trim() || null;
  const shouldBeAbsent = data.onLeave === true || normalizedCityId === null;
  const finalCityId = shouldBeAbsent ? null : normalizedCityId;

  if (!normalizedName) {
    throw new Error('Informe o nome do técnico');
  }

  if (!Object.values(TechnicianType).includes(data.type)) {
    throw new Error('Tipo de técnico inválido');
  }

  if (finalCityId) {
    await getRegionalCity(finalCityId, user.regional);
  }

  const order = await getNextTechnicianOrder(user.regional, finalCityId);

  await prisma.technician.create({
    data: {
      code: normalizedCode || createInternalTechnicianCode(),
      name: normalizedName,
      type: data.type,
      canField: data.canField === true,
      canDelivery: data.canDelivery === true,
      canPickup: data.canPickup === true,
      canDoorRelease: data.canDoorRelease === true,
      canInternal: data.canInternal === true,
      osLimit: Math.max(1, Math.floor(Number(data.osLimit) || 20)),
      cityId: finalCityId,
      supportCityId: null,
      onLeave: shouldBeAbsent,
      onPickup: false,
      regional: user.regional,
      order,
    },
  });

  revalidateTechnicianViews();
}

export async function deleteTechnician(technicianId: string) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);
  const technician = await getAccessibleTechnician(technicianId, [user.regional]);

  await prisma.technician.delete({ where: { id: technicianId } });
  await cleanupSharedCell(technician.sharedCellId);

  revalidateTechnicianViews();
}

export async function updateTechnician(
  technicianId: string,
  data: {
    name?: string;
    code?: string;
    osLimit?: number;
    cityId?: string | null;
    canField?: boolean;
    canDelivery?: boolean;
    canPickup?: boolean;
    canDoorRelease?: boolean;
    canInternal?: boolean;
    onLeave?: boolean;
    onPickup?: boolean;
  }
) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);
  const technician = await getAccessibleTechnician(technicianId, [user.regional]);
  const normalizedName = data.name?.trim();
  const normalizedCode = data.code?.trim();
  const normalizedCityId = data.cityId === undefined ? undefined : data.cityId?.trim() || null;

  if (data.name !== undefined && !normalizedName) {
    throw new Error('Informe o nome do técnico');
  }

  if (normalizedCityId) {
    await getRegionalCity(normalizedCityId, user.regional);
  }

  const resolvedOnLeave =
    normalizedCityId !== undefined
      ? normalizedCityId === null
      : data.onLeave === true
        ? true
        : undefined;
  const resolvedCityId =
    normalizedCityId !== undefined ? normalizedCityId : resolvedOnLeave === true ? null : undefined;

  const targetCityChanged =
    resolvedCityId !== undefined && resolvedCityId !== (technician.cityId ?? null);
  const nextOrder =
    targetCityChanged && resolvedCityId !== undefined
      ? await getNextTechnicianOrder(technician.regional, resolvedCityId)
      : undefined;

  // Campos listados um a um: a Server Action recebe o objeto do cliente, e
  // espalhar `...data` deixaria gravar qualquer coluna (regional, OS, dupla).
  await prisma.technician.update({
    where: { id: technicianId },
    data: {
      osLimit:
        data.osLimit !== undefined ? Math.max(1, Math.floor(Number(data.osLimit) || 1)) : undefined,
      canField: optionalBoolean(data.canField),
      canDelivery: optionalBoolean(data.canDelivery),
      canPickup: optionalBoolean(data.canPickup),
      canDoorRelease: optionalBoolean(data.canDoorRelease),
      canInternal: optionalBoolean(data.canInternal),
      name: normalizedName,
      code: data.code !== undefined ? normalizedCode || createInternalTechnicianCode() : undefined,
      cityId: resolvedCityId,
      supportCityId:
        resolvedCityId === null || resolvedCityId === technician.supportCityId ? null : undefined,
      onLeave: resolvedOnLeave,
      onPickup: resolvedOnLeave ? false : optionalBoolean(data.onPickup),
      order: nextOrder,
      // Dupla só existe na mesma lotação: quem muda de cidade sai da dupla.
      sharedCellId: targetCityChanged ? null : undefined,
    },
  });

  if (targetCityChanged) {
    await cleanupSharedCell(technician.sharedCellId);
  }

  revalidateTechnicianViews();
}

export async function updateTechnicianSupportCity(
  technicianId: string,
  supportCityId: string | null,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicianSnapshot = await getTechnicianPlanSnapshot(technician, scheduleDate);
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (supportCityId === null) {
    if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
      await upsertTechnicianDayPlan(technician, editableScheduleDate, { supportCityId: null });
    } else {
      await prisma.technician.update({
        where: { id: technician.id },
        data: { supportCityId: null },
      });
    }

    revalidateTechnicianViews();
    return;
  }

  if (technicianSnapshot.onLeave) {
    throw new Error('Técnico ausente não pode receber apoio.');
  }

  if (technicianSnapshot.cityId === supportCityId) {
    throw new Error('A cidade de apoio precisa ser diferente da lotação principal.');
  }

  await getSupportCityForTechnician(
    supportCityId,
    technician.regional,
    technician.name,
    technician.type
  );

  if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    await upsertTechnicianDayPlan(technician, editableScheduleDate, { supportCityId });
  } else {
    await prisma.technician.update({
      where: { id: technician.id },
      data: { supportCityId },
    });
  }

  revalidateTechnicianViews();
}

export async function updateTechnicianPair(
  technicianId: string,
  partnerId: string | null,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicianSnapshot = await getTechnicianPlanSnapshot(technician, scheduleDate);
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (!partnerId) {
    const previousSharedCellId = technicianSnapshot.sharedCellId;

    if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
      await upsertTechnicianDayPlan(technician, editableScheduleDate, { sharedCellId: null });
    } else {
      await prisma.technician.update({
        where: { id: technician.id },
        data: { sharedCellId: null },
      });
    }

    if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
      await cleanupDailySharedCell(previousSharedCellId, editableScheduleDate);
    } else {
      await cleanupSharedCell(previousSharedCellId);
    }
    revalidateTechnicianViews();
    return;
  }

  if (partnerId === technicianId) {
    throw new Error('Escolha outro técnico para formar a dupla');
  }

  const partner = await getAccessibleTechnician(partnerId, accessibleRegionals);
  const partnerSnapshot = await getTechnicianPlanSnapshot(partner, scheduleDate);

  if (partner.regional !== technician.regional) {
    throw new Error('A dupla precisa estar na mesma regional');
  }

  if (
    (partnerSnapshot.cityId ?? null) !== (technicianSnapshot.cityId ?? null) ||
    partnerSnapshot.onLeave !== technicianSnapshot.onLeave
  ) {
    throw new Error('A dupla precisa estar na mesma lotação');
  }

  const groupId = randomUUID();
  const previousSharedIds = [technicianSnapshot.sharedCellId, partnerSnapshot.sharedCellId].filter(
    Boolean
  );

  if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    await prisma.$transaction(
      [technician, partner].map((member) =>
        prisma.technicianDayPlan.upsert({
          where: {
            technicianId_dateKey: {
              technicianId: member.id,
              dateKey: editableScheduleDate,
            },
          },
          create: {
            technicianId: member.id,
            dateKey: editableScheduleDate,
            ...buildDayPlanSeed(member.id === technician.id ? technicianSnapshot : partnerSnapshot),
            sharedCellId: groupId,
            osField: technicianSnapshot.osField,
            osDelivery: technicianSnapshot.osDelivery,
            osPickup: technicianSnapshot.osPickup,
            osDoorRelease: technicianSnapshot.osDoorRelease,
            osInternal: technicianSnapshot.osInternal,
          },
          update: {
            sharedCellId: groupId,
            osField: technicianSnapshot.osField,
            osDelivery: technicianSnapshot.osDelivery,
            osPickup: technicianSnapshot.osPickup,
            osDoorRelease: technicianSnapshot.osDoorRelease,
            osInternal: technicianSnapshot.osInternal,
          },
        })
      )
    );
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.technician.updateMany({
        where: { id: { in: [technician.id, partner.id] } },
        data: {
          sharedCellId: groupId,
          osField: technician.osField,
          osDelivery: technician.osDelivery,
          osPickup: technician.osPickup,
          osDoorRelease: technician.osDoorRelease,
          osInternal: technician.osInternal,
        },
      });
    });
  }

  // Quem estava em outra dupla deixa o antigo parceiro sozinho: desfaz o
  // "grupo de um" que sobrou (no dia, ou no cadastro).
  for (const sharedCellId of previousSharedIds) {
    if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
      await cleanupDailySharedCell(sharedCellId, editableScheduleDate);
    } else {
      await cleanupSharedCell(sharedCellId);
    }
  }

  revalidateTechnicianViews();
}

export async function updateTechnicianGroupSupportCity(
  technicianId: string,
  supportCityId: string | null,
  scheduleDate?: string | null
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const technician = await getAccessibleTechnician(technicianId, accessibleRegionals);
  const technicians = await getTechnicianGroupMembersForSchedule(technician, scheduleDate);
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (supportCityId === null) {
    if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
      await prisma.$transaction(
        technicians.map((member) =>
          prisma.technicianDayPlan.upsert({
            where: {
              technicianId_dateKey: {
                technicianId: member.id,
                dateKey: editableScheduleDate,
              },
            },
            create: {
              technicianId: member.id,
              dateKey: editableScheduleDate,
              ...buildDayPlanSeed(member),
              supportCityId: null,
            },
            update: { supportCityId: null },
          })
        )
      );
    } else {
      await prisma.technician.updateMany({
        where: {
          id: {
            in: technicians.map((member) => member.id),
          },
        },
        data: { supportCityId: null },
      });
    }

    revalidateTechnicianViews();
    return;
  }

  for (const member of technicians) {
    if (member.onLeave) {
      throw new Error('Técnico ausente não pode receber apoio.');
    }

    if (member.cityId === supportCityId) {
      throw new Error('A cidade de apoio precisa ser diferente da lotação principal.');
    }

    await getSupportCityForTechnician(supportCityId, member.regional, member.name, member.type);
  }

  if (editableScheduleDate && shouldUseDailySchedule(technician.regional, editableScheduleDate)) {
    await prisma.$transaction(
      technicians.map((member) =>
        prisma.technicianDayPlan.upsert({
          where: {
            technicianId_dateKey: {
              technicianId: member.id,
              dateKey: editableScheduleDate,
            },
          },
          create: {
            technicianId: member.id,
            dateKey: editableScheduleDate,
            ...buildDayPlanSeed(member),
            supportCityId,
          },
          update: { supportCityId },
        })
      )
    );
  } else {
    await prisma.technician.updateMany({
      where: {
        id: {
          in: technicians.map((member) => member.id),
        },
      },
      data: { supportCityId },
    });
  }

  revalidateTechnicianViews();
}

export async function resetDailyOS(scheduleDate?: string | null, regionalView?: RegionalView) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user).filter(
    (regional) => !regionalView || regionalView === 'ALL' || regional === regionalView
  );
  const editableScheduleDate = validateEditableScheduleDate(scheduleDate);

  if (editableScheduleDate) {
    const scheduledTechnicians = await prisma.technician.findMany({
      where: { regional: { in: accessibleRegionals } },
    });

    const operations: Prisma.PrismaPromise<unknown>[] = [
      ...scheduledTechnicians.map((technician) =>
        prisma.technicianDayPlan.upsert({
          where: {
            technicianId_dateKey: {
              technicianId: technician.id,
              dateKey: editableScheduleDate,
            },
          },
          create: {
            technicianId: technician.id,
            dateKey: editableScheduleDate,
            ...buildDayPlanSeed(technician),
            osField: 0,
            osDelivery: 0,
            osPickup: 0,
            osDoorRelease: 0,
            osInternal: 0,
          },
          update: {
            osField: 0,
            osDelivery: 0,
            osPickup: 0,
            osDoorRelease: 0,
            osInternal: 0,
          },
        })
      ),
    ];

    await prisma.$transaction(operations);
  } else {
    await prisma.technician.updateMany({
      where: { regional: { in: accessibleRegionals } },
      data: { osField: 0, osDelivery: 0, osPickup: 0, osDoorRelease: 0, osInternal: 0 },
    });
  }

  revalidateTechnicianViews();
}

export async function updateTechnicianCode(technicianId: string, code: string) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);
  const accessibleRegionals = getAccessibleRegionals(user);
  const normalizedCode = code.trim();

  await getAccessibleTechnician(technicianId, accessibleRegionals);

  await prisma.technician.update({
    where: { id: technicianId },
    data: {
      code: normalizedCode || createInternalTechnicianCode(),
    },
  });

  revalidateTechnicianViews();
}
