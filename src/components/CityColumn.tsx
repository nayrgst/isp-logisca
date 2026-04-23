'use client';

import { useTransition } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TechnicianCard } from '@/components/TechnicianCard';
import type { CityWithTechnicians } from '@/types';
import { deleteTechnician } from '@/app/actions/technician';

interface Props {
  city: CityWithTechnicians;
  isSupervisor: boolean;
}

export function CityColumn({ city, isSupervisor }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: city.id });
  const [isPending, startTransition] = useTransition();
  const visibleTechs = city.technicians;

  const totalField = city.technicians
    .filter((t) => t.type === 'CLT')
    .reduce((s, t) => s + t.osField, 0);
  const totalDelivery = city.technicians.reduce((s, t) => s + t.osDelivery, 0);
  const totalPickup = city.technicians.reduce((s, t) => s + t.osPickup, 0);
  const totalDoorRelease = city.technicians.reduce((s, t) => s + t.osDoorRelease, 0);
  const totalAll = totalField + totalDelivery + totalPickup + totalDoorRelease;
  const cityLabel = city.name;

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remover técnico ${name}?`)) return;

    startTransition(async () => {
      await deleteTechnician(id);
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[260px] max-w-[280px] shrink-0 rounded-2xl border transition-all duration-200
        ${
          isOver
            ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-900/20'
            : 'border-gray-800 bg-gray-900/50'
        }`}
    >
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">{cityLabel}</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {visibleTechs.length} técnicos
            </span>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-gray-500">
              Field: <span className="text-blue-400 font-medium">{totalField}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[11px] text-gray-500">
              Del: <span className="text-green-400 font-medium">{totalDelivery}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-[11px] text-gray-500">
              Ret: <span className="text-purple-400 font-medium">{totalPickup}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span className="text-[11px] text-gray-500">
              Porta: <span className="text-cyan-400 font-medium">{totalDoorRelease}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[11px] text-gray-500">
              Total: <span className="text-white font-bold">{totalAll}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Drop indicator */}
      {isOver && <div className="mx-3 mt-3 h-1 rounded-full bg-blue-500 animate-pulse" />}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)]">
        {visibleTechs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-700 text-sm">
            <svg
              className="w-8 h-8 mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
              />
            </svg>
            <span className="opacity-60">
              {city.isVirtual ? 'Arraste aqui quem estiver ausente' : 'Arraste tecnicos aqui'}
            </span>
          </div>
        ) : (
          visibleTechs.map((tech) => (
            <TechnicianCard
              key={`${tech.id}-${tech.osField}-${tech.osDelivery}-${tech.osPickup}-${tech.osDoorRelease}-${tech.osLimit}-${tech.onLeave}-${tech.canField}-${tech.canDelivery}-${tech.canPickup}-${tech.canDoorRelease}`}
              technician={tech}
              isSupervisor={isSupervisor}
              onDelete={isSupervisor ? (id) => handleDelete(id, tech.name) : undefined}
            />
          ))
        )}
      </div>

      {isPending && <div className="px-3 pb-3 text-xs text-blue-400">Atualizando cidade...</div>}
    </div>
  );
}
