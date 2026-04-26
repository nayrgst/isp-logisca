'use client';

import { useMemo, useState, useTransition } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { deleteTechnician } from '@/app/actions/technician';
import { TechnicianCard } from '@/components/TechnicianCard';
import { TechnicianGroupCard } from '@/components/TechnicianGroupCard';
import { getTechnicianLoad } from '@/lib/board';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';
import type { CityWithTechnicians, FilterMode, TechnicianCell, TechnicianWithCity } from '@/types';

interface Props {
  city: CityWithTechnicians;
  cells: TechnicianCell[];
  isSupervisor: boolean;
  filterMode: FilterMode;
  supportCity: { id: string; name: string } | null;
  supportTechnicians: TechnicianWithCity[];
}

export function CityColumn({
  city,
  cells,
  isSupervisor,
  filterMode,
  supportCity,
  supportTechnicians,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: city.id });
  const [isPending, startTransition] = useTransition();
  const [absentSearch, setAbsentSearch] = useState('');
  const filteredCells = useMemo(() => {
    if (!city.isVirtual) return cells;

    const term = absentSearch.trim().toLowerCase();
    if (!term) return cells;

    return cells.filter((cell) =>
      cell.technicians.some(
        (technician) =>
          technician.name.toLowerCase().includes(term) ||
          technician.code.toLowerCase().includes(term)
      )
    );
  }, [absentSearch, cells, city.isVirtual]);
  const visibleTechs = filteredCells.flatMap((cell) => cell.technicians);

  const totalField = filteredCells.reduce(
    (sum, cell) => sum + (cell.technicians[0]?.canField ? cell.technicians[0]?.osField ?? 0 : 0),
    0
  );
  const totalDelivery = filteredCells.reduce(
    (sum, cell) =>
      sum + (cell.technicians[0]?.canDelivery ? cell.technicians[0]?.osDelivery ?? 0 : 0),
    0
  );
  const totalPickup = filteredCells.reduce(
    (sum, cell) => sum + (cell.technicians[0]?.canPickup ? cell.technicians[0]?.osPickup ?? 0 : 0),
    0
  );
  const totalDoorRelease = filteredCells.reduce(
    (sum, cell) =>
      sum + (cell.technicians[0]?.canDoorRelease ? cell.technicians[0]?.osDoorRelease ?? 0 : 0),
    0
  );
  const totalAll = totalField + totalDelivery + totalPickup + totalDoorRelease;
  const allCityTechnicians = city.technicians;

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remover técnico ${name}?`)) return;

    startTransition(async () => {
      await deleteTechnician(id);
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex max-w-[300px] min-w-[280px] shrink-0 flex-col rounded-2xl border transition-all duration-200 ${
        isOver
          ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-900/20'
          : 'border-gray-800 bg-gray-900/50'
      }`}
    >
      <div className="border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{city.name}</h3>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {visibleTechs.length} técnicos
            </span>
            {supportTechnicians.length > 0 && (
              <span className="rounded-full bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300">
                {supportTechnicians.length} apoio
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-3">
          <StatDot color="blue" label="Field" value={totalField} />
          <StatDot color="green" label="Del" value={totalDelivery} />
          <StatDot color="purple" label="Ret" value={totalPickup} />
          <StatDot color="cyan" label="Porta" value={totalDoorRelease} />
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[11px] text-gray-500">
              Total: <span className="font-bold text-white">{totalAll}</span>
            </span>
          </div>
        </div>

        {city.isVirtual && (
          <div className="mt-3">
            <input
              value={absentSearch}
              onChange={(event) => setAbsentSearch(event.target.value)}
              placeholder="Buscar ausente por nome ou código"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {isOver && <div className="mx-3 mt-3 h-1 animate-pulse rounded-full bg-blue-500" />}

      <div className="min-h-[120px] max-h-[calc(100vh-280px)] flex-1 overflow-y-auto p-3">
        <SortableContext items={filteredCells.map((cell) => cell.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {filteredCells.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center text-sm text-gray-700">
                <svg
                  className="mb-2 h-8 w-8 opacity-50"
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
                  {city.isVirtual ? 'Arraste aqui quem estiver ausente' : 'Arraste técnicos aqui'}
                </span>
              </div>
            ) : (
              filteredCells.map((cell) =>
                cell.technicians.length > 1 ? (
                  <TechnicianGroupCard
                    key={cell.id}
                    cell={cell}
                    isSupervisor={isSupervisor}
                    supportCity={supportCity}
                    onDelete={isSupervisor ? handleDelete : undefined}
                  />
                ) : (
                  <TechnicianCard
                    key={cell.id}
                    technician={cell.technicians[0]}
                    dragId={cell.id}
                    isSupervisor={isSupervisor}
                    supportCity={supportCity}
                    pairCandidates={allCityTechnicians.filter(
                      (candidate) => candidate.id !== cell.technicians[0].id
                    )}
                    onDelete={isSupervisor ? (id) => handleDelete(id, cell.technicians[0].name) : undefined}
                  />
                )
              )
            )}
          </div>
        </SortableContext>

        {supportTechnicians.length > 0 && (
          <div className="mt-4 border-t border-emerald-900/30 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
                Apoio
              </span>
              <span className="text-[11px] text-gray-500">Cobertura secundária</span>
            </div>
            <div className="space-y-2">
              {supportTechnicians.map((technician) => (
                <div
                  key={`support-${technician.id}`}
                  className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{technician.name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        Base: {technician.city?.name ?? 'Sem cidade'}
                        {hasVisibleTechnicianCode(technician.code)
                          ? ` · ${formatTechnicianCode(technician.code)}`
                          : ''}
                      </p>
                    </div>
                    <span className="rounded-md border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300">
                      {getTechnicianLoad(technician, filterMode)} OS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isPending && <div className="px-3 pb-3 text-xs text-blue-400">Atualizando cidade...</div>}
    </div>
  );
}

function StatDot({
  color,
  label,
  value,
}: {
  color: 'blue' | 'green' | 'purple' | 'cyan';
  label: string;
  value: number;
}) {
  const dotClass = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
  }[color];

  const valueClass = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  }[color];

  return (
    <div className="flex items-center gap-1">
      <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="text-[11px] text-gray-500">
        {label}: <span className={`font-medium ${valueClass}`}>{value}</span>
      </span>
    </div>
  );
}
