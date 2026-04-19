'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Regional, TechnicianType } from '@prisma/client';
import { requireSessionUser, requireSupervisor } from '@/lib/session';
import { createInternalTechnicianCode } from '@/lib/technician';

async function getRegionalTechnician(technicianId: string, regional: Regional) {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, regional },
  });

  if (!technician) {
    throw new Error('Técnico não encontrado na sua regional');
  }

  return technician;
}

async function getRegionalCity(cityId: string, regional: Regional) {
  const city = await prisma.city.findFirst({
    where: { id: cityId, regional },
  });

  if (!city) {
    throw new Error('Cidade não encontrada na sua regional');
  }

  return city;
}

// ─── Mover técnico entre cidades ─────────────────────────────────────────────
export async function moveTechnicianToCity(technicianId: string, cityId: string | null) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);

  await getRegionalTechnician(technicianId, user.regional);
  if (cityId) {
    await getRegionalCity(cityId, user.regional);
  }

  await prisma.technician.update({
    where: { id: technicianId },
    data: { cityId },
  });

  revalidatePath('/dashboard');
}

// ─── Atualizar OS de técnico ──────────────────────────────────────────────────
export async function updateTechnicianOS(
  technicianId: string,
  field: 'osField' | 'osDelivery',
  value: number
) {
  const session = await getServerSession(authOptions);
  const user = requireSessionUser(session);

  const technician = await getRegionalTechnician(technicianId, user.regional);

  if (field === 'osField' && technician.type === 'TER') {
    throw new Error('Técnico TER não possui OS Field');
  }

  await prisma.technician.update({
    where: { id: technicianId },
    data: { [field]: Math.max(0, value) },
  });

  revalidatePath('/dashboard');
}

// ─── Criar técnico (apenas SUPERVISOR) ───────────────────────────────────────
export async function createTechnician(data: {
  code?: string;
  name: string;
  type: TechnicianType;
  osLimit: number;
  cityId?: string;
}) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  const normalizedCode = data.code?.trim();
  if (normalizedCode) {
    const existing = await prisma.technician.findUnique({ where: { code: normalizedCode } });
    if (existing) throw new Error('Código de técnico já existe');
  }

  if (data.cityId) {
    await getRegionalCity(data.cityId, user.regional);
  }

  await prisma.technician.create({
    data: {
      code: normalizedCode || createInternalTechnicianCode(),
      name: data.name.trim(),
      type: data.type,
      osLimit: data.osLimit,
      cityId: data.cityId || null,
      regional: user.regional,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

// ─── Deletar técnico (apenas SUPERVISOR) ─────────────────────────────────────
export async function deleteTechnician(technicianId: string) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  await getRegionalTechnician(technicianId, user.regional);

  await prisma.technician.delete({ where: { id: technicianId } });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

// ─── Atualizar técnico (apenas SUPERVISOR) ────────────────────────────────────
export async function updateTechnician(
  technicianId: string,
  data: { name?: string; osLimit?: number; onLeave?: boolean; onPickup?: boolean }
) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  await getRegionalTechnician(technicianId, user.regional);
  const normalizedName = data.name?.trim();

  if (data.name !== undefined && !normalizedName) {
    throw new Error('Informe o nome do técnico');
  }

  await prisma.technician.update({
    where: { id: technicianId },
    data: {
      ...data,
      name: normalizedName,
      onLeave: data.onLeave === true ? true : data.onPickup === true ? false : data.onLeave,
      onPickup: data.onPickup === true ? true : data.onLeave === true ? false : data.onPickup,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

// ─── Toggle folga/retirada ────────────────────────────────────────────────────
export async function toggleTechnicianStatus(
  technicianId: string,
  field: 'onLeave' | 'onPickup',
  value: boolean
) {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  const technician = await getRegionalTechnician(technicianId, user.regional);

  await prisma.technician.update({
    where: { id: technicianId },
    data:
      field === 'onLeave'
        ? { onLeave: value, onPickup: value ? false : technician.onPickup }
        : { onPickup: value, onLeave: value ? false : technician.onLeave },
  });

  revalidatePath('/dashboard');
}

// ─── Resetar OS do dia ────────────────────────────────────────────────────────
export async function resetDailyOS() {
  const session = await getServerSession(authOptions);
  const user = requireSupervisor(session);

  await prisma.technician.updateMany({
    where: { regional: user.regional },
    data: { osField: 0, osDelivery: 0 },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}
