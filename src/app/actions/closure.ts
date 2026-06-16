'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { ClosureAgent, Regional } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { getCurrentMonthRange } from '@/lib/schedule';
import { AGENT_VALUES, type ClosureCounts, type MonthlyClosureSummary } from '@/lib/closure';

function emptyCounts(): ClosureCounts {
  return AGENT_VALUES.reduce((acc, agent) => {
    acc[agent] = 0;
    return acc;
  }, {} as ClosureCounts);
}

export async function getMonthlyClosureCounts(): Promise<MonthlyClosureSummary> {
  const { start, endExclusive, label } = getCurrentMonthRange();

  const grouped = await prisma.closureRecord.groupBy({
    by: ['agent'],
    where: { closureDate: { gte: start, lt: endExclusive } },
    _count: { _all: true },
  });

  const counts = emptyCounts();
  for (const row of grouped) {
    counts[row.agent] = row._count._all;
  }

  return { monthLabel: label, counts };
}

export async function registerClosure(input: {
  agent: ClosureAgent;
  regional: Regional;
  closureDate: string;
  clientCode?: string;
  clientName?: string;
  osNumber?: string;
}): Promise<MonthlyClosureSummary> {
  const session = await getServerSession(authOptions);
  requireSessionUser(session);

  if (!AGENT_VALUES.includes(input.agent)) {
    throw new Error('Agente inválido');
  }

  if (!Object.values(Regional).includes(input.regional)) {
    throw new Error('Regional inválida');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.closureDate)) {
    throw new Error('Data de encerramento inválida');
  }

  await prisma.closureRecord.create({
    data: {
      agent: input.agent,
      regional: input.regional,
      closureDate: input.closureDate,
      clientCode: input.clientCode?.trim() || null,
      clientName: input.clientName?.trim() || null,
      osNumber: input.osNumber?.trim() || null,
    },
  });

  revalidatePath('/encerramento-os');

  return getMonthlyClosureCounts();
}
