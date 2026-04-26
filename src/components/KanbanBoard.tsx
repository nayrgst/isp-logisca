'use client';

import { useEffect, useMemo, useReducer, useState, useTransition } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { CityColumn } from '@/components/CityColumn';
import { TechnicianCard } from '@/components/TechnicianCard';
import { TechnicianGroupCard } from '@/components/TechnicianGroupCard';
import { persistTechnicianLayout, resetDailyOS } from '@/app/actions/technician';
import {
  buildTechnicianCells,
  doesCellMatchFilters,
  doesTechnicianMatchFilters,
  flattenCellsToTechnicians,
  getTechnicianLoad,
} from '@/lib/board';
import { isSerraDouradaCityName } from '@/lib/support';
import { hasVisibleTechnicianCode } from '@/lib/technician';
import type { CityWithTechnicians, FilterMode, RegionalView, TechnicianCell } from '@/types';
import { Regional } from '@prisma/client';

const STORAGE_KEYS = {
  filterMode: 'isp-logistica:dashboard:filter-mode',
  regionalView: 'isp-logistica:dashboard:regional-view',
  search: 'isp-logistica:dashboard:search',
};

interface Props {
  cities: CityWithTechnicians[];
  isSupervisor: boolean;
}

export function KanbanBoard({ cities: initialCities, isSupervisor }: Props) {
  const router = useRouter();
  const [cities, setCities] = useReducer(
    (_: CityWithTechnicians[], nextCities: CityWithTechnicians[]) => nextCities,
    initialCities
  );
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    if (typeof window === 'undefined') return 'ALL';
    const savedFilterMode = window.localStorage.getItem(STORAGE_KEYS.filterMode);
    return savedFilterMode === 'FIELD' || savedFilterMode === 'DELIVERY' ? savedFilterMode : 'ALL';
  });
  const [regionalView, setRegionalView] = useState<RegionalView>(() => {
    if (typeof window === 'undefined') return Regional.DF02;
    const savedRegionalView = window.localStorage.getItem(STORAGE_KEYS.regionalView);
    return savedRegionalView === 'ALL' || savedRegionalView === Regional.DF03
      ? savedRegionalView
      : Regional.DF02;
  });
  const [activeCell, setActiveCell] = useState<TechnicianCell | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_KEYS.search) ?? '';
  });
  const [copyFeedback, setCopyFeedback] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setCities(initialCities);
  }, [initialCities]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.filterMode, filterMode);
  }, [filterMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.regionalView, regionalView);
  }, [regionalView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.search, search);
  }, [search]);

  useEffect(() => {
    const refresh = () => router.refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  const cityEntries = useMemo(
    () =>
      cities.map((city) => ({
        city,
        cells: buildTechnicianCells(city.technicians, city),
      })),
    [cities]
  );

  const supportCityByRegional = useMemo(
    () =>
      new Map(
        cities
          .filter((city) => !city.isVirtual && isSerraDouradaCityName(city.name))
          .map((city) => [city.regional, { id: city.id, name: city.name }] as const)
      ),
    [cities]
  );

  const activeTechnicians = useMemo(
    () => cityEntries.flatMap(({ cells }) => cells.flatMap((cell) => cell.technicians)),
    [cityEntries]
  );

  const visibleCityEntries = useMemo(
    () =>
      cityEntries
        .filter(({ city }) => isSupervisor || regionalView === 'ALL' || city.regional === regionalView)
        .map(({ city, cells }) => {
          const visibleCells = cells.filter((cell) => doesCellMatchFilters(cell, filterMode, search));
          const supportTechnicians = activeTechnicians.filter(
            (technician) =>
              technician.supportCityId === city.id &&
              technician.cityId !== city.id &&
              doesTechnicianMatchFilters(technician, filterMode, search)
          );

          return {
            city,
            cells: visibleCells,
            supportTechnicians,
            supportCity: supportCityByRegional.get(city.regional) ?? null,
          };
        })
        .filter(({ cells, supportTechnicians }) => cells.length > 0 || supportTechnicians.length > 0 || !search.trim()),
    [activeTechnicians, cityEntries, filterMode, isSupervisor, regionalView, search, supportCityByRegional]
  );

  const visibleTechnicians = useMemo(
    () => visibleCityEntries.flatMap(({ cells }) => cells.flatMap((cell) => cell.technicians)),
    [visibleCityEntries]
  );
  const visiblePrimaryCells = useMemo(
    () => visibleCityEntries.flatMap(({ cells }) => cells),
    [visibleCityEntries]
  );

  const stats = useMemo(() => {
    const totalOS = visiblePrimaryCells.reduce(
      (sum, cell) => sum + (cell.technicians[0] ? getTechnicianLoad(cell.technicians[0], 'ALL') : 0),
      0
    );

    return {
      totalOS,
      totalTechs: visibleTechnicians.length,
      onLeave: visibleTechnicians.filter((technician) => technician.onLeave).length,
    };
  }, [visiblePrimaryCells, visibleTechnicians]);

  const currentRegionalLabel = useMemo(() => {
    if (isSupervisor) {
      return visibleCityEntries[0]?.city.regional.replace('DF', '') ?? '02';
    }

    if (regionalView === 'ALL') {
      return '02/03';
    }

    return regionalView.replace('DF', '');
  }, [isSupervisor, regionalView, visibleCityEntries]);

  function findContainerId(id: string) {
    if (cities.some((city) => city.id === id)) return id;

    for (const entry of cityEntries) {
      if (entry.cells.some((cell) => cell.id === id)) {
        return entry.city.id;
      }
    }

    return null;
  }

  function findCellById(id: string) {
    for (const entry of cityEntries) {
      const match = entry.cells.find((cell) => cell.id === id);
      if (match) return match;
    }

    return null;
  }

  function buildLoadText() {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    });
    const date = formatter.format(new Date());
    const titleLabel =
      filterMode === 'DELIVERY' ? 'DELIVERY' : filterMode === 'FIELD' ? 'FIELD' : 'GERAL';

    const exportCities = visibleCityEntries.filter(
      ({ cells, supportTechnicians }) => cells.length > 0 || supportTechnicians.length > 0
    );
    const total = exportCities.reduce(
      (sum, { cells }) =>
        sum +
        cells.reduce(
          (citySum, cell) =>
            citySum +
            (cell.technicians[0] ? getTechnicianLoad(cell.technicians[0], filterMode) : 0),
          0
        ),
      0
    );

    const blocks = exportCities.map(({ city, cells, supportTechnicians }) => {
      const terLines: string[] = [];
      const cltLines: string[] = [];

      cells.forEach((cell) => {
        const reference = cell.technicians[0];
        if (!reference) return;

        const load = getTechnicianLoad(reference, filterMode);
        const memberLabel = cell.technicians
          .map((technician) => {
            const codeSuffix = hasVisibleTechnicianCode(technician.code) ? ` [${technician.code}]` : '';
            return `${technician.name}${codeSuffix}`;
          })
          .join(' + ');

        const line = `• ${memberLabel} - ${load}`;

        if (reference.type === 'TER') {
          terLines.push(line);
        } else {
          cltLines.push(line);
        }
      });

      const supportRows = supportTechnicians.filter(
        (technician) =>
          !cells.some((cell) => cell.technicians.some((member) => member.id === technician.id))
      );

      const lines: string[] = [`📍 ${city.name.toUpperCase()}`, ''];

      if (terLines.length > 0) {
        lines.push('*[TER]*');
        lines.push(...terLines);
        lines.push('');
      }

      if (cltLines.length > 0) {
        lines.push('*[CLT]*');
        lines.push(...cltLines);
        if (supportRows.length > 0) {
          lines.push('');
        }
      }

      if (supportRows.length > 0) {
        lines.push('*[APOIO]*');
        supportRows.forEach((technician) => {
          const codeSuffix = hasVisibleTechnicianCode(technician.code) ? ` [${technician.code}]` : '';
          const baseLabel = technician.city?.name ? ` (base ${technician.city.name})` : '';
          lines.push(
            `• ${technician.name}${codeSuffix}${baseLabel} - ${getTechnicianLoad(technician, filterMode)}`
          );
        });
      }

      return lines.join('\n').trimEnd();
    });

    return [
      `📦 ${titleLabel} ${currentRegionalLabel} - CARGA ${date} - TOTAL: ${total} OS`,
      '____________________________________________',
      '',
      blocks.join('\n____________________________________________\n\n'),
    ]
      .join('\n')
      .trim();
  }

  async function handleCopyLoad() {
    try {
      await navigator.clipboard.writeText(buildLoadText());
      setCopyFeedback('Carga copiada!');
      window.setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Não foi possível copiar.');
      window.setTimeout(() => setCopyFeedback(''), 2500);
    }
  }

  function handleResetOS() {
    if (!confirm('Limpar todas as OS visíveis no dashboard atual?')) return;

    startTransition(async () => {
      try {
        await resetDailyOS();
      } catch {
        setError('Não foi possível limpar as OS. Tente novamente.');
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const cell = findCellById(String(event.active.id));
    setActiveCell(cell);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCell(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const sourceCityId = findContainerId(activeId);
    const targetCityId = findContainerId(overId);

    if (!sourceCityId || !targetCityId) return;

    const sourceEntry = cityEntries.find((entry) => entry.city.id === sourceCityId);
    const targetEntry = cityEntries.find((entry) => entry.city.id === targetCityId);
    if (!sourceEntry || !targetEntry) return;

    const movedCell = sourceEntry.cells.find((cell) => cell.id === activeId);
    if (!movedCell) return;

    if (sourceCityId === targetCityId && activeId === overId) return;

    const sourceCellsWithoutMoved = sourceEntry.cells.filter((cell) => cell.id !== activeId);
    const targetBaseCells =
      sourceCityId === targetCityId
        ? sourceCellsWithoutMoved
        : [...targetEntry.cells];

    let insertIndex = targetBaseCells.length;
    if (overId !== targetCityId) {
      const overIndex = targetBaseCells.findIndex((cell) => cell.id === overId);
      if (overIndex >= 0) {
        insertIndex = overIndex;
      }
    }

    const movedToTarget: TechnicianCell = {
      ...movedCell,
      regional: targetEntry.city.regional,
      cityId: targetEntry.city.isVirtual ? null : targetEntry.city.id,
    };

    const nextTargetCells = [
      ...targetBaseCells.slice(0, insertIndex),
      movedToTarget,
      ...targetBaseCells.slice(insertIndex),
    ];

    const nextCities = cities.map((city) => {
      if (city.id === sourceCityId && city.id === targetCityId) {
        return {
          ...city,
          technicians: flattenCellsToTechnicians(nextTargetCells, targetEntry.city),
        };
      }

      if (city.id === sourceCityId) {
        return {
          ...city,
          technicians: flattenCellsToTechnicians(sourceCellsWithoutMoved, sourceEntry.city),
        };
      }

      if (city.id === targetCityId) {
        return {
          ...city,
          technicians: flattenCellsToTechnicians(nextTargetCells, targetEntry.city),
        };
      }

      return city;
    });

    const updates = nextCities
      .filter((city) => city.id === sourceCityId || city.id === targetCityId)
      .flatMap((city) =>
        city.technicians.map((technician) => ({
          id: technician.id,
          cityId: technician.cityId,
          order: technician.order,
        }))
      );

    const previousCities = cities;
    setCities(nextCities);

    startTransition(async () => {
      try {
        await persistTechnicianLayout(updates);
      } catch {
        setCities(previousCities);
        setError('Não foi possível salvar a nova ordem. Revise a regional e tente novamente.');
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-800 bg-gray-950 px-6 py-3">
        <span className="text-sm text-gray-500">Visualização:</span>
        {(['ALL', 'FIELD', 'DELIVERY'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterMode(mode)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              filterMode === mode
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {mode === 'ALL' ? 'Todos' : mode === 'FIELD' ? 'Field' : 'Delivery'}
          </button>
        ))}
        {!isSupervisor && (
          <div className="ml-2">
            <select
              value={regionalView}
              onChange={(event) => setRegionalView(event.target.value as RegionalView)}
              className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={Regional.DF02}>DF02</option>
              <option value={Regional.DF03}>DF03</option>
              <option value="ALL">Ambas</option>
            </select>
          </div>
        )}
        <div className="ml-2 w-full max-w-xs">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar técnico ou código"
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={handleCopyLoad}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          Copiar carga
        </button>
        <button
          type="button"
          onClick={handleResetOS}
          className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/40 hover:text-red-200"
        >
          Limpar OS
        </button>
        {copyFeedback && <span className="text-xs text-green-400">{copyFeedback}</span>}

        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            <span className="font-semibold text-white">{stats.totalTechs}</span> técnicos
          </span>
          <span className="text-gray-500">
            <span className="font-semibold text-white">{stats.totalOS}</span> OS total
          </span>
          {stats.onLeave > 0 && (
            <span className="text-yellow-500">
              <span className="font-semibold">{stats.onLeave}</span> ausentes
            </span>
          )}
          {isPending && <span className="animate-pulse text-xs text-blue-400">Salvando...</span>}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-full gap-4 p-6">
            {visibleCityEntries.map(({ city, cells, supportTechnicians, supportCity }) => (
              <CityColumn
                key={city.id}
                city={city}
                cells={cells}
                filterMode={filterMode}
                supportCity={supportCity}
                supportTechnicians={supportTechnicians}
                isSupervisor={isSupervisor}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCell &&
              (activeCell.technicians.length > 1 ? (
                <div className="scale-105 rotate-2 opacity-90">
                  <TechnicianGroupCard cell={activeCell} isSupervisor={false} draggable={false} />
                </div>
              ) : (
                <div className="scale-105 rotate-2 opacity-90">
                  <TechnicianCard
                    technician={activeCell.technicians[0]}
                    dragId={activeCell.id}
                    isSupervisor={false}
                    draggable={false}
                  />
                </div>
              ))}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
