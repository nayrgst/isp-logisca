'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { CityColumn } from '@/components/CityColumn';
import { TechnicianCard } from '@/components/TechnicianCard';
import { moveTechnicianToCity } from '@/app/actions/technician';
import type { CityWithTechnicians, TechnicianWithCity, FilterMode } from '@/types';

const UNASSIGNED_CITY_ID = '__UNASSIGNED__';

interface Props {
  cities: CityWithTechnicians[];
  isSupervisor: boolean;
}

export function KanbanBoard({ cities: initialCities, isSupervisor }: Props) {
  const [cities, setCities] = useState(initialCities);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [activeTech, setActiveTech] = useState<TechnicianWithCity | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const tech = event.active.data.current?.technician as TechnicianWithCity;
    setActiveTech(tech);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTech(null);
    const { active, over } = event;
    if (!over) return;

    const techId = active.id as string;
    const targetCityId = over.id as string;
    const normalizedTargetCityId = targetCityId === UNASSIGNED_CITY_ID ? null : targetCityId;

    // Find current city
    let sourceCityId: string | null = null;
    for (const city of cities) {
      if (city.technicians.some((t) => t.id === techId)) {
        sourceCityId = city.id;
        break;
      }
    }

    const normalizedSourceCityId = sourceCityId === UNASSIGNED_CITY_ID ? null : sourceCityId;

    if (normalizedSourceCityId === normalizedTargetCityId) return;

    const previousCities = cities;
    const nextCities = cities.map((city) => {
      const tech = previousCities
        .flatMap((currentCity) => currentCity.technicians)
        .find((t) => t.id === techId);
      if (!tech) return city;

      if (city.id === sourceCityId) {
        return { ...city, technicians: city.technicians.filter((t) => t.id !== techId) };
      }

      if (city.id === targetCityId) {
        return {
          ...city,
          technicians: [
            ...city.technicians,
            { ...tech, cityId: normalizedTargetCityId, city: city.isVirtual ? null : city },
          ],
        };
      }

      return city;
    });

    setCities(nextCities);

    startTransition(async () => {
      try {
        await moveTechnicianToCity(techId, normalizedTargetCityId);
      } catch {
        setCities(previousCities);
        setError('Não foi possível mover o técnico. Revise a regional e tente novamente.');
      }
    });
  }

  const allTechs = useMemo(() => cities.flatMap((c) => c.technicians), [cities]);

  const stats = useMemo(() => {
    const totalOS = allTechs.reduce(
      (sum, technician) =>
        sum +
        technician.osField +
        technician.osDelivery +
        technician.osPickup +
        technician.osDoorRelease,
      0
    );
    const totalTechs = allTechs.length;
    const onLeave = allTechs.filter((technician) => technician.onLeave).length;

    return { totalOS, totalTechs, onLeave };
  }, [allTechs]);

  const visibleCities = useMemo(
    () =>
      cities
        .map((city) => ({
          ...city,
          technicians: city.technicians.filter((technician) => {
            if (filterMode === 'FIELD' && !technician.canField) return false;
            if (filterMode === 'DELIVERY' && !technician.canDelivery) return false;
            const term = search.trim().toLowerCase();
            if (!term) return true;

            return (
              technician.name.toLowerCase().includes(term) ||
              technician.code.toLowerCase().includes(term)
            );
          }),
        }))
        .filter((city) => city.technicians.length > 0 || !search.trim()),
    [cities, filterMode, search]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-950">
        <span className="text-gray-500 text-sm">Visualização:</span>
        {(['ALL', 'FIELD', 'DELIVERY'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${
                filterMode === mode
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
          >
            {mode === 'ALL' ? 'Todos' : mode === 'FIELD' ? 'Field' : 'Delivery'}
          </button>
        ))}
        <div className="ml-2 w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tecnico ou codigo"
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick stats */}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            <span className="text-white font-semibold">{stats.totalTechs}</span> técnicos
          </span>
          <span className="text-gray-500">
            <span className="text-white font-semibold">{stats.totalOS}</span> OS total
          </span>
          {stats.onLeave > 0 && (
            <span className="text-yellow-500">
              <span className="font-semibold">{stats.onLeave}</span> em folga/férias
            </span>
          )}
          {isPending && <span className="text-blue-400 text-xs animate-pulse">Salvando...</span>}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 min-h-full">
            {visibleCities.map((city) => (
              <CityColumn key={city.id} city={city} isSupervisor={isSupervisor} />
            ))}
          </div>

          <DragOverlay>
            {activeTech && (
              <div className="rotate-2 opacity-90 scale-105">
                <TechnicianCard technician={activeTech} isSupervisor={false} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
