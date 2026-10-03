'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Regional } from '@prisma/client';
import { requireSupervisor } from '@/lib/session';

async function getRegionalCity(cityId: string, regional: Regional) {
  const city = await prisma.city.findFirst({
    where: { id: cityId, regional },
  });

  if (!city) {
    throw new Error('Cidade não encontrada na sua regional');
  }

  return city;
}

export async function createCity(name: string) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  const regional = user.regional;
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error('Informe o nome da cidade');
  }

  const existing = await prisma.city.findUnique({
    where: { name_regional: { name: normalizedName, regional } },
  });
  if (existing) throw new Error('Cidade já existe nessa regional');

  const count = await prisma.city.count({ where: { regional } });

  await prisma.city.create({
    data: { name: normalizedName, regional, order: count },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

export async function updateCity(cityId: string, name: string) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  const city = await getRegionalCity(cityId, user.regional);
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error('Informe o nome da cidade');
  }

  const existing = await prisma.city.findUnique({
    where: { name_regional: { name: normalizedName, regional: user.regional } },
  });

  if (existing && existing.id !== city.id) {
    throw new Error('Cidade já existe nessa regional');
  }

  await prisma.city.update({
    where: { id: cityId },
    data: { name: normalizedName },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

export async function deleteCity(cityId: string) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  await getRegionalCity(cityId, user.regional);

  // Técnicos desta cidade vão para Ausente — no cadastro e também nos planos
  // por data. Os planos guardam o id da cidade sem chave estrangeira; se não
  // forem atualizados, o técnico some do quadro nos dias já planejados (não
  // cai em cidade nenhuma nem nos ausentes).
  const regionalTechnician = { technician: { regional: user.regional } };
  await prisma.$transaction([
    prisma.technician.updateMany({
      where: { cityId, regional: user.regional },
      data: { cityId: null, supportCityId: null, onLeave: true },
    }),
    prisma.technician.updateMany({
      where: { supportCityId: cityId, regional: user.regional },
      data: { supportCityId: null },
    }),
    prisma.technicianDayPlan.updateMany({
      where: { cityId, ...regionalTechnician },
      data: { cityId: null, supportCityId: null, onLeave: true },
    }),
    prisma.technicianDayPlan.updateMany({
      where: { supportCityId: cityId, ...regionalTechnician },
      data: { supportCityId: null },
    }),
    prisma.city.delete({ where: { id: cityId } }),
  ]);

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}
