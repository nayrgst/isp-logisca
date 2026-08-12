'use client';

import { useMemo, useState, useTransition } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { deleteTechnician } from '@/app/actions/technician';
import { TechnicianCard } from '@/components/TechnicianCard';
import { TechnicianGroupCard } from '@/components/TechnicianGroupCard';
import { getTechnicianLoad } from '@/lib/board';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';
import { ABSENCE_REASONS, getAbsenceLabel } from '@/lib/absence';
import { GREEN_AREAS, isGreenAreaCityName } from '@/lib/greenAreas';
import { OS_VISUALS, OS_VISUAL_ORDER, type OSVisualKey } from '@/lib/osVisuals';
import { Badge } from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { CityWithTechnicians, TechnicianCell, TechnicianWithCity } from '@/types';

interface Props {
  city: CityWithTechnicians;
  cells: TechnicianCell[];
  isSupervisor: boolean;
  supportCity: { id: string; name: string } | null;
  supportTechnicians: TechnicianWithCity[];
  scheduleDate?: string | null;
  readOnly?: boolean;
}

export function CityColumn({
  city,
  cells,
  isSupervisor,
  supportCity,
  supportTechnicians,
  scheduleDate = null,
  readOnly = false,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: city.id });
  const [isPending, startTransition] = useTransition();
  const askConfirm = useConfirm();
  const { showToast } = useToast();
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

  const columnTotals = useMemo(() => {
    const sum = (
      can: (technician: TechnicianWithCity) => boolean,
      os: (technician: TechnicianWithCity) => number
    ) =>
      filteredCells.reduce((total, cell) => {
        const reference = cell.technicians[0];
        if (!reference || !can(reference)) return total;
        return total + (os(reference) ?? 0);
      }, 0);

    return {
      field: sum((t) => t.canField, (t) => t.osField),
      delivery: sum((t) => t.canDelivery, (t) => t.osDelivery),
      pickup: sum((t) => t.canPickup, (t) => t.osPickup),
      door: sum((t) => t.canDoorRelease, (t) => t.osDoorRelease),
      internal: sum((t) => t.canInternal, (t) => t.osInternal),
    } satisfies Record<OSVisualKey, number>;
  }, [filteredCells]);

  const totalAll = OS_VISUAL_ORDER.reduce((sum, key) => sum + columnTotals[key], 0);
  const allCityTechnicians = city.technicians;
  const isGreenArea = !city.isVirtual && city.regional === 'DF02' && isGreenAreaCityName(city.name);

  /* Cobertura por sub-área: responde "sobrou alguma área sem técnico hoje?",
     que antes só dava para saber abrindo card por card. */
  const areaCoverage = useMemo(() => {
    if (!isGreenArea) return null;

    const counts = new Map(GREEN_AREAS.map((area) => [area.value, 0]));
    for (const cell of filteredCells) {
      for (const technician of cell.technicians) {
        for (const area of technician.areas ?? []) {
          const current = counts.get(area);
          if (current !== undefined) counts.set(area, current + 1);
        }
      }
    }

    return GREEN_AREAS.map((area) => ({ ...area, count: counts.get(area.value) ?? 0 }));
  }, [filteredCells, isGreenArea]);

  const uncoveredCount = areaCoverage?.filter((area) => area.count === 0).length ?? 0;

  const orderedCells = useMemo(() => {
    if (!city.isVirtual) return filteredCells;
    const rank = (cell: TechnicianCell) => {
      const reason = cell.technicians[0]?.absenceReason;
      const index = ABSENCE_REASONS.findIndex((option) => option.value === reason);
      return index === -1 ? ABSENCE_REASONS.length : index;
    };
    return [...filteredCells].sort((a, b) => rank(a) - rank(b));
  }, [city.isVirtual, filteredCells]);

  const absentRenderItems = useMemo(() => {
    const items: Array<
      { type: 'header'; label: string; key: string } | { type: 'cell'; cell: TechnicianCell }
    > = [];
    let lastLabel: string | null = null;
    for (const cell of orderedCells) {
      if (city.isVirtual) {
        const label = getAbsenceLabel(cell.technicians[0]?.absenceReason);
        if (label !== lastLabel) {
          lastLabel = label;
          items.push({ type: 'header', label, key: `header-${label}` });
        }
      }
      items.push({ type: 'cell', cell });
    }
    return items;
  }, [city.isVirtual, orderedCells]);

  async function handleDelete(id: string, name: string) {
    const confirmed = await askConfirm({
      title: 'Remover técnico',
      message: `${name} sairá do quadro. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteTechnician(id);
        showToast(`${name} foi removido.`, 'success');
      } catch {
        showToast('Não foi possível remover o técnico.', 'error');
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full max-w-[300px] min-w-[280px] shrink-0 flex-col rounded-panel border transition-[border-color,background-color,box-shadow] duration-200 ease-out-quart ${
        isOver
          ? 'border-brand bg-brand/6 shadow-raised'
          : 'border-line bg-surface/60'
      }`}
    >
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-ink" title={city.name}>
            {city.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <Badge>{visibleTechs.length} téc.</Badge>
            {supportTechnicians.length > 0 && (
              <Badge tone="support">{supportTechnicians.length} apoio</Badge>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {OS_VISUAL_ORDER.map((key) => (
            <StatDot key={key} visualKey={key} value={columnTotals[key]} />
          ))}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[11px] text-ink-subtle">
              Total: <span className="tabular font-bold text-ink">{totalAll}</span>
            </span>
          </div>
        </div>

        {areaCoverage && (
          <div className="mt-2 border-t border-line pt-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Cobertura
              </span>
              {uncoveredCount > 0 ? (
                <Badge tone="warn">
                  {uncoveredCount} sem técnico
                </Badge>
              ) : (
                <Badge tone="ok">Completa</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {areaCoverage.map((area) => (
                <span
                  key={area.value}
                  title={
                    area.count === 0
                      ? `${area.value}: nenhum técnico`
                      : `${area.value}: ${area.count} técnico(s)`
                  }
                  className={`inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5 text-[10px] transition-colors duration-150 ${
                    area.count === 0
                      ? 'border-warn/40 bg-warn/10 text-warn'
                      : 'border-area/30 bg-area/8 text-area'
                  }`}
                >
                  {area.label}
                  <span className="tabular font-semibold">
                    {area.count === 0 ? '—' : area.count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {city.isVirtual && (
          <div className="mt-3">
            <input
              value={absentSearch}
              onChange={(event) => setAbsentSearch(event.target.value)}
              placeholder="Buscar ausente por nome ou código"
              aria-label="Buscar ausente por nome ou código"
              className="w-full rounded-control border border-line-strong bg-canvas px-3 py-2 text-xs text-ink placeholder-ink-subtle transition-[border-color] duration-150 focus:border-brand focus:outline-none"
            />
          </div>
        )}
      </div>

      {isOver && (
        <div className="mx-3 mt-3 flex animate-pop items-center justify-center gap-2 rounded-card border border-dashed border-brand bg-brand/10 px-3 py-2 text-xs font-medium text-brand-strong">
          <svg className="h-4 w-4 animate-breathe" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Solte aqui para mover
        </div>
      )}

      {/* `min-h-0` é o que permite o flex encolher e a rolagem acontecer aqui
          dentro; sem ele o filho força a altura e a coluna estoura. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SortableContext items={orderedCells.map((cell) => cell.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {orderedCells.length === 0 ? (
              <div className="flex min-h-40 animate-fade-in flex-col items-center justify-center rounded-card border border-dashed border-line text-sm text-ink-subtle">
                <svg
                  className="mb-2 h-8 w-8 opacity-60"
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
                <span className="text-center text-xs">
                  {city.isVirtual ? 'Arraste aqui quem estiver ausente' : 'Arraste técnicos aqui'}
                </span>
              </div>
            ) : (
              absentRenderItems.map((item) =>
                item.type === 'header' ? (
                  <div key={item.key} className="flex items-center gap-2 pt-2 first:pt-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-absent">
                      {item.label}
                    </span>
                    <div className="h-px flex-1 bg-absent/25" />
                  </div>
                ) : item.cell.technicians.length > 1 ? (
                  <TechnicianGroupCard
                    key={item.cell.id}
                    cell={item.cell}
                    isSupervisor={isSupervisor}
                    supportCity={supportCity}
                    scheduleDate={scheduleDate}
                    readOnly={readOnly}
                    draggable={!readOnly}
                    greenArea={isGreenArea}
                    onDelete={isSupervisor ? handleDelete : undefined}
                  />
                ) : (
                  <TechnicianCard
                    key={item.cell.id}
                    technician={item.cell.technicians[0]}
                    dragId={item.cell.id}
                    isSupervisor={isSupervisor}
                    draggable={!readOnly}
                    supportCity={supportCity}
                    scheduleDate={scheduleDate}
                    readOnly={readOnly}
                    greenArea={isGreenArea}
                    pairCandidates={allCityTechnicians.filter(
                      (candidate) => candidate.id !== item.cell.technicians[0].id
                    )}
                    onDelete={
                      isSupervisor
                        ? (id) => handleDelete(id, item.cell.technicians[0].name)
                        : undefined
                    }
                  />
                )
              )
            )}
          </div>
        </SortableContext>

        {supportTechnicians.length > 0 && (
          <div className="mt-4 border-t border-support/25 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-support">
                Apoio
              </span>
              <span className="text-[11px] text-ink-subtle">Cobertura secundária</span>
            </div>
            <div className="space-y-2">
              {supportTechnicians.map((technician) => (
                <div
                  key={`support-${technician.id}`}
                  className="rounded-card border border-support/25 bg-support/6 px-3 py-2 transition-colors duration-150 hover:border-support/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{technician.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Base: {technician.city?.name ?? 'Sem cidade'}
                        {hasVisibleTechnicianCode(technician.code)
                          ? ` · ${formatTechnicianCode(technician.code)}`
                          : ''}
                      </p>
                    </div>
                    <Badge tone="support">{getTechnicianLoad(technician)} OS</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isPending && (
        <div className="animate-fade-in px-3 pb-3 text-xs text-brand-strong">Atualizando cidade…</div>
      )}
    </div>
  );
}

function StatDot({ visualKey, value }: { visualKey: OSVisualKey; value: number }) {
  const visual = OS_VISUALS[visualKey];

  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${visual.solid}`} />
      <span className="text-[11px] text-ink-subtle">
        {visual.short}: <span className={`tabular font-semibold ${visual.text}`}>{value}</span>
      </span>
    </div>
  );
}
