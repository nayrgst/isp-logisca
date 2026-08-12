'use client';

import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from 'react';
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CityColumn } from '@/components/CityColumn';
import { TechnicianCard } from '@/components/TechnicianCard';
import { TechnicianGroupCard } from '@/components/TechnicianGroupCard';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { DatePicker } from '@/components/ui/DatePicker';
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
import type {
  CityWithTechnicians,
  DailyScheduleConfig,
  FilterMode,
  RegionalView,
  TechnicianCell,
} from '@/types';
import { Regional } from '@prisma/client';

const STORAGE_KEYS = {
  filterMode: 'isp-logistica:dashboard:filter-mode',
  regionalView: 'isp-logistica:dashboard:regional-view',
  search: 'isp-logistica:dashboard:search',
};

interface Props {
  cities: CityWithTechnicians[];
  isSupervisor: boolean;
  dailySchedule?: DailyScheduleConfig;
}

export function KanbanBoard({ cities: initialCities, isSupervisor, dailySchedule }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cities, setCities] = useReducer(
    (_: CityWithTechnicians[], nextCities: CityWithTechnicians[]) => nextCities,
    initialCities
  );
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    if (typeof window === 'undefined') return 'ALL';
    const savedFilterMode = window.localStorage.getItem(STORAGE_KEYS.filterMode);
    return savedFilterMode === 'MEI' || savedFilterMode === 'CLT' ? savedFilterMode : 'ALL';
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
  const { showToast } = useToast();
  const askConfirm = useConfirm();
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_KEYS.search) ?? '';
  });
  const isScheduleReadOnly = Boolean(dailySchedule?.enabled && !dailySchedule.isEditable);
  const shouldShowScheduleSelector = Boolean(dailySchedule?.enabled);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = activeCell !== null || isPending;
  }, [activeCell, isPending]);

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
    const refresh = () => {
      if (busyRef.current) return;
      router.refresh();
    };
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
        .filter(
          ({ city }) => isSupervisor || regionalView === 'ALL' || city.regional === regionalView
        )
        .map(({ city, cells }) => {
          const visibleCells = cells.filter((cell) =>
            doesCellMatchFilters(cell, filterMode, search)
          );
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
        .filter(
          ({ cells, supportTechnicians }) =>
            cells.length > 0 || supportTechnicians.length > 0 || !search.trim()
        ),
    [
      activeTechnicians,
      cityEntries,
      filterMode,
      isSupervisor,
      regionalView,
      search,
      supportCityByRegional,
    ]
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
      (sum, cell) =>
        sum + (cell.technicians[0] ? getTechnicianLoad(cell.technicians[0]) : 0),
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
    const exportDate = dailySchedule?.enabled
      ? new Date(`${dailySchedule.selectedDate}T00:00:00`)
      : new Date();
    const date = formatter.format(exportDate);
    const titleLabel =
      filterMode === 'MEI' ? 'MEI' : filterMode === 'CLT' ? 'CLT' : 'GERAL';

    const exportCities = visibleCityEntries.filter(
      ({ cells, supportTechnicians }) => cells.length > 0 || supportTechnicians.length > 0
    );
    const total = exportCities.reduce(
      (sum, { cells }) =>
        sum +
        cells.reduce(
          (citySum, cell) =>
            citySum +
            (cell.technicians[0] ? getTechnicianLoad(cell.technicians[0]) : 0),
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

        const load = getTechnicianLoad(reference);
        const memberLabel = cell.technicians
          .map((technician) => {
            const codeSuffix = hasVisibleTechnicianCode(technician.code)
              ? ` [${technician.code}]`
              : '';
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
          const codeSuffix = hasVisibleTechnicianCode(technician.code)
            ? ` [${technician.code}]`
            : '';
          const baseLabel = technician.city?.name ? ` (base ${technician.city.name})` : '';
          lines.push(
            `• ${technician.name}${codeSuffix}${baseLabel} - ${getTechnicianLoad(technician)}`
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
      showToast('Carga copiada!', 'success');
    } catch {
      showToast('Não foi possível copiar.', 'error');
    }
  }

  async function handleResetOS() {
    const confirmed = await askConfirm({
      title: 'Limpar OS do dia',
      message:
        'Todas as OS visíveis no dashboard atual voltam a zero. Esta ação não pode ser desfeita.',
      confirmLabel: 'Limpar OS',
      tone: 'danger',
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await resetDailyOS(
          dailySchedule?.enabled ? dailySchedule.selectedDate : null,
          isSupervisor ? undefined : regionalView
        );
        showToast('OS do dia limpas.', 'success');
      } catch {
        showToast('Não foi possível limpar as OS. Tente novamente.', 'error');
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const cell = findCellById(String(event.active.id));
    if (cell && isScheduleReadOnly) return;
    setActiveCell(cell);
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
    if (isScheduleReadOnly) {
      return;
    }

    const movedCell = sourceEntry.cells.find((cell) => cell.id === activeId);
    if (!movedCell) return;

    if (sourceCityId === targetCityId && activeId === overId) return;

    const sourceCellsWithoutMoved = sourceEntry.cells.filter((cell) => cell.id !== activeId);
    const targetBaseCells =
      sourceCityId === targetCityId ? sourceCellsWithoutMoved : [...targetEntry.cells];

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
        await persistTechnicianLayout(
          updates,
          dailySchedule?.enabled ? dailySchedule.selectedDate : null
        );
      } catch {
        setCities(previousCities);
        showToast('Não foi possível salvar a nova ordem. Revise a regional e tente novamente.', 'error');
      }
    });
  }

  function handleSelectScheduleDate(dateKey: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('date', dateKey);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas px-6 py-3">
        {/* Segmented control: o indicador desliza entre as opções em vez de o
            fundo simplesmente aparecer na opção nova. */}
        <div className="relative flex rounded-control bg-surface p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 w-[calc((100%-0.5rem)/3)] rounded-[0.375rem] bg-brand shadow-card transition-transform duration-200 ease-out-quart"
            style={{
              transform: `translateX(${['ALL', 'MEI', 'CLT'].indexOf(filterMode) * 100}%)`,
            }}
          />
          {(['ALL', 'MEI', 'CLT'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              aria-pressed={filterMode === mode}
              className={`relative z-10 w-16 rounded-[0.375rem] py-1.5 text-sm font-medium transition-colors duration-200 ${
                filterMode === mode ? 'text-white' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {mode === 'ALL' ? 'Todos' : mode}
            </button>
          ))}
        </div>
        {!isSupervisor && (
          <div className="ml-2">
            <select
              value={regionalView}
              onChange={(event) => setRegionalView(event.target.value as RegionalView)}
              aria-label="Regional"
              className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-brand/50 focus:border-brand focus:outline-none"
            >
              <option value={Regional.DF02}>DF02</option>
              <option value={Regional.DF03}>DF03</option>
              <option value="ALL">Ambas</option>
            </select>
          </div>
        )}
        <div className="relative ml-2 w-full max-w-xs">
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar técnico ou código"
            aria-label="Buscar técnico ou código"
            className="w-full rounded-control border border-line-strong bg-surface py-2 pl-9 pr-8 text-sm text-ink placeholder-ink-subtle transition-[border-color] duration-150 focus:border-brand focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle transition-colors hover:text-ink"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {shouldShowScheduleSelector && dailySchedule?.enabled && (
          <div className="ml-2 flex items-center gap-3 rounded-control border border-line bg-surface/70 px-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Carga do dia
              </span>
              <span className="text-[11px] text-ink-subtle">Planejamento mensal DF02 e DF03</span>
            </div>
            <DatePicker
              value={dailySchedule.selectedDate}
              onChange={handleSelectScheduleDate}
              todayDateKey={dailySchedule.todayDate}
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLoad} className="gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copiar carga
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleResetOS}
            disabled={Boolean(isPending)}
            className="gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Limpar OS
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-canvas px-6 py-2 text-sm">
        <span className="text-ink-subtle">
          <span className="tabular font-semibold text-ink">{stats.totalTechs}</span> técnicos
        </span>
        <span className="text-ink-subtle">
          <span className="tabular font-semibold text-ink">{stats.totalOS}</span> OS total
        </span>
        {stats.onLeave > 0 && (
          <span className="text-absent">
            <span className="tabular font-semibold">{stats.onLeave}</span> ausentes
          </span>
        )}
        <div className="ml-auto">
          {isPending ? (
            <span className="flex animate-fade-in items-center gap-1.5 text-xs text-brand-strong">
              <Spinner className="h-3.5 w-3.5" />
              Salvando…
            </span>
          ) : (
            <span className="flex animate-fade-in items-center gap-1.5 text-xs text-ink-subtle">
              <svg className="h-3.5 w-3.5 text-ok" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Salvo
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4 p-6">
            {visibleCityEntries.map(({ city, cells, supportTechnicians, supportCity }) => (
              <CityColumn
                key={city.id}
                city={city}
                cells={cells}
                supportCity={supportCity}
                supportTechnicians={supportTechnicians}
                isSupervisor={isSupervisor}
                scheduleDate={dailySchedule?.enabled ? dailySchedule.selectedDate : null}
                readOnly={isScheduleReadOnly}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCell &&
              (activeCell.technicians.length > 1 ? (
                <div className="rotate-2 scale-105 rounded-card opacity-95 shadow-drag will-change-transform">
                  <TechnicianGroupCard cell={activeCell} isSupervisor={false} draggable={false} />
                </div>
              ) : (
                <div className="rotate-2 scale-105 rounded-card opacity-95 shadow-drag will-change-transform">
                  <TechnicianCard
                    technician={activeCell.technicians[0]}
                    dragId={activeCell.id}
                    isSupervisor={false}
                    draggable={false}
                    scheduleDate={dailySchedule?.enabled ? dailySchedule.selectedDate : null}
                  />
                </div>
              ))}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
