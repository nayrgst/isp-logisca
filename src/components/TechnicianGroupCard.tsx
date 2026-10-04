'use client';

import { useRef, useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  updateTechnician,
  updateTechnicianGroupAbsenceReason,
  updateTechnicianGroupAreas,
  updateTechnicianGroupOS,
  updateTechnicianGroupSupportCity,
  updateTechnicianPair,
} from '@/app/actions/technician';
import { getCellOperations, getOSLoad } from '@/lib/board';
import { formatTechnicianCode } from '@/lib/technician';
import { getSupportRestrictionReason } from '@/lib/support';
import { ABSENCE_REASONS, getAbsenceLabel } from '@/lib/absence';
import { OS_VISUALS, type OSVisualKey } from '@/lib/osVisuals';
import { Badge } from '@/components/ui/Badge';
import { ChipButton } from '@/components/ui/ChipButton';
import { GreenAreaPicker } from '@/components/ui/GreenAreaPicker';
import { OperationCheckbox, OSField } from '@/components/ui/OSField';
import { MoveMenu } from '@/components/ui/MoveMenu';
import { useToast } from '@/components/ui/Toast';
import type { TechnicianCell } from '@/types';

type EditableField = 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease' | 'osInternal';

interface Props {
  cell: TechnicianCell;
  isSupervisor: boolean;
  onDelete?: (id: string, name: string) => void;
  draggable?: boolean;
  supportCity?: { id: string; name: string } | null;
  scheduleDate?: string | null;
  readOnly?: boolean;
  greenArea?: boolean;
}

export function TechnicianGroupCard({
  cell,
  isSupervisor,
  onDelete,
  draggable = true,
  supportCity = null,
  scheduleDate = null,
  readOnly = false,
  greenArea = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editingOperationsForId, setEditingOperationsForId] = useState<string | null>(null);
  const [operationsDraft, setOperationsDraft] = useState({
    canField: false,
    canDelivery: false,
    canPickup: false,
    canDoorRelease: false,
    canInternal: false,
  });
  const [osField, setOsField] = useState(cell.technicians[0]?.osField ?? 0);
  const [osDelivery, setOsDelivery] = useState(cell.technicians[0]?.osDelivery ?? 0);
  const [osPickup, setOsPickup] = useState(cell.technicians[0]?.osPickup ?? 0);
  const [osDoorRelease, setOsDoorRelease] = useState(cell.technicians[0]?.osDoorRelease ?? 0);
  const [osInternal, setOsInternal] = useState(cell.technicians[0]?.osInternal ?? 0);
  const [dirtyFields, setDirtyFields] = useState<Set<EditableField>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const sortable = useSortable({
    id: cell.id,
    data: {
      type: 'cell',
      technicianIds: cell.technicians.map((technician) => technician.id),
    },
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
    zIndex: sortable.isDragging ? 999 : undefined,
  };

  const representative = cell.technicians[0];
  const isAbsent = Boolean(representative?.onLeave);
  const serverOsKey = `${representative?.osField ?? 0}|${representative?.osDelivery ?? 0}|${representative?.osPickup ?? 0}|${representative?.osDoorRelease ?? 0}|${representative?.osInternal ?? 0}`;
  const [lastServerOsKey, setLastServerOsKey] = useState(serverOsKey);
  if (serverOsKey !== lastServerOsKey && editingField === null) {
    setLastServerOsKey(serverOsKey);
    setOsField(representative?.osField ?? 0);
    setOsDelivery(representative?.osDelivery ?? 0);
    setOsPickup(representative?.osPickup ?? 0);
    setOsDoorRelease(representative?.osDoorRelease ?? 0);
    setOsInternal(representative?.osInternal ?? 0);
    if (dirtyFields.size > 0) setDirtyFields(new Set());
  }

  const showsLocal = (field: EditableField) => editingField === field || dirtyFields.has(field);
  const resolvedOsField = showsLocal('osField') ? osField : representative?.osField ?? 0;
  const resolvedOsDelivery = showsLocal('osDelivery') ? osDelivery : representative?.osDelivery ?? 0;
  const resolvedOsPickup = showsLocal('osPickup') ? osPickup : representative?.osPickup ?? 0;
  const resolvedOsDoorRelease = showsLocal('osDoorRelease')
    ? osDoorRelease
    : representative?.osDoorRelease ?? 0;
  const resolvedOsInternal = showsLocal('osInternal') ? osInternal : representative?.osInternal ?? 0;
  const sharedLimit = Math.min(...cell.technicians.map((technician) => technician.osLimit));
  // A dupla atende toda operação que pelo menos um dos membros possui.
  const operations = getCellOperations(cell.technicians);
  const totalOS = getOSLoad(
    {
      osField: resolvedOsField,
      osDelivery: resolvedOsDelivery,
      osPickup: resolvedOsPickup,
      osDoorRelease: resolvedOsDoorRelease,
      osInternal: resolvedOsInternal,
    },
    operations
  );
  const percentage = sharedLimit > 0 ? Math.min(100, (totalOS / sharedLimit) * 100) : 0;
  const isOverLimit = totalOS > sharedLimit;
  const isSupportActive = Boolean(
    supportCity && cell.technicians.every((technician) => technician.supportCityId === supportCity.id)
  );
  const supportRestrictionReason = supportCity
    ? cell.technicians
        .map((technician) =>
          getSupportRestrictionReason({
            technicianName: technician.name,
            supportCityName: supportCity.name,
            regional: technician.regional,
            technicianType: technician.type,
          })
        )
        .find(Boolean) ?? null
    : null;
  const canToggleSupport =
    Boolean(supportCity) && cell.technicians.every((technician) => technician.cityId !== supportCity?.id);

  const osBlocks = (
    [
      { key: 'osField', visual: 'field', enabled: operations.canField, value: resolvedOsField },
      {
        key: 'osDelivery',
        visual: 'delivery',
        enabled: operations.canDelivery,
        value: resolvedOsDelivery,
      },
      { key: 'osPickup', visual: 'pickup', enabled: operations.canPickup, value: resolvedOsPickup },
      {
        key: 'osDoorRelease',
        visual: 'door',
        enabled: operations.canDoorRelease,
        value: resolvedOsDoorRelease,
      },
      {
        key: 'osInternal',
        visual: 'internal',
        enabled: operations.canInternal,
        value: resolvedOsInternal,
      },
    ] satisfies Array<{ key: EditableField; visual: OSVisualKey; enabled: boolean; value: number }>
  ).filter((block) => block.enabled);

  function getOriginalValue(field: EditableField) {
    if (field === 'osField') return representative?.osField ?? 0;
    if (field === 'osDelivery') return representative?.osDelivery ?? 0;
    if (field === 'osPickup') return representative?.osPickup ?? 0;
    if (field === 'osInternal') return representative?.osInternal ?? 0;
    return representative?.osDoorRelease ?? 0;
  }

  function setLocalValue(field: EditableField, value: number) {
    if (field === 'osField') setOsField(value);
    else if (field === 'osDelivery') setOsDelivery(value);
    else if (field === 'osPickup') setOsPickup(value);
    else if (field === 'osInternal') setOsInternal(value);
    else setOsDoorRelease(value);
  }

  function getLocalValue(field: EditableField) {
    if (field === 'osField') return osField;
    if (field === 'osDelivery') return osDelivery;
    if (field === 'osPickup') return osPickup;
    if (field === 'osInternal') return osInternal;
    return osDoorRelease;
  }

  function markDirty(field: EditableField, dirty: boolean) {
    setDirtyFields((prev) => {
      const updated = new Set(prev);
      if (dirty) updated.add(field);
      else updated.delete(field);
      return updated;
    });
  }

  function saveOS(field: EditableField, value: number, previousValue: number) {
    if (!representative) return;

    setLocalValue(field, value);
    // Mantém o valor novo na tela até o servidor responder (sem "piscar" o velho).
    markDirty(field, true);

    startTransition(async () => {
      try {
        await updateTechnicianGroupOS(representative.id, field, value, scheduleDate);
      } catch {
        showToast('Não foi possível salvar a OS da dupla. Tente novamente.', 'error');
        setLocalValue(field, previousValue);
        markDirty(field, false);
      }
    });
  }

  function handleStep(field: EditableField, delta: number) {
    if (readOnly || !representative) return;
    const current = showsLocal(field) ? getLocalValue(field) : getOriginalValue(field);
    const next = Math.max(0, current + delta);
    if (next === current) return;

    saveOS(field, next, getOriginalValue(field));
  }

  function handleDoubleClick(field: EditableField) {
    if (readOnly) return;
    setLocalValue(field, getOriginalValue(field));
    setEditingField(field);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function handleBlur(field: EditableField, value: number) {
    setEditingField(null);
    const previousValue = getOriginalValue(field);
    if (value === previousValue) return;

    saveOS(field, value, previousValue);
  }

  function handleKeyDown(event: React.KeyboardEvent, field: EditableField, value: number) {
    if (event.key === 'Enter') handleBlur(field, value);
    if (event.key === 'Escape') {
      setEditingField(null);
      setLocalValue(field, getOriginalValue(field));
    }
  }

  function handleUngroup() {
    if (!representative) return;

    startTransition(async () => {
      try {
        await updateTechnicianPair(representative.id, null, scheduleDate);
      } catch {
        showToast('Não foi possível separar a dupla. Tente novamente.', 'error');
      }
    });
  }

  function handleSupportToggle() {
    if (!supportCity || !representative || supportRestrictionReason) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupSupportCity(
          representative.id,
          isSupportActive ? null : supportCity.id,
          scheduleDate
        );
      } catch {
        showToast('Não foi possível alterar o apoio da dupla. Tente novamente.', 'error');
      }
    });
  }

  function handleAbsenceReasonChange(value: string) {
    if (readOnly || !representative) return;
    const next = value || null;
    if (next === (representative.absenceReason ?? null)) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupAbsenceReason(representative.id, next, scheduleDate);
      } catch {
        showToast('Não foi possível salvar o motivo. Tente novamente.', 'error');
      }
    });
  }

  function handleSetAreas(next: string[]) {
    if (readOnly || !representative) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupAreas(representative.id, next, scheduleDate);
      } catch {
        showToast('Não foi possível salvar a área da dupla. Tente novamente.', 'error');
      }
    });
  }

  function handleToggleArea(area: string) {
    const current = representative?.areas ?? [];
    handleSetAreas(
      current.includes(area) ? current.filter((value) => value !== area) : [...current, area]
    );
  }

  function openOperationsEditor(technicianId: string) {
    const technician = cell.technicians.find((member) => member.id === technicianId);
    if (!technician || readOnly) return;
    if (editingOperationsForId === technicianId) {
      setEditingOperationsForId(null);
      return;
    }
    setEditingOperationsForId(technicianId);
    setOperationsDraft({
      canField: technician.canField,
      canDelivery: technician.canDelivery,
      canPickup: technician.canPickup,
      canDoorRelease: technician.canDoorRelease,
      canInternal: technician.canInternal,
    });
  }

  function saveOperationsEditor() {
    if (!editingOperationsForId) return;
    const technician = cell.technicians.find((member) => member.id === editingOperationsForId);
    setEditingOperationsForId(null);
    if (!technician) return;

    const hasChanged =
      operationsDraft.canField !== technician.canField ||
      operationsDraft.canDelivery !== technician.canDelivery ||
      operationsDraft.canPickup !== technician.canPickup ||
      operationsDraft.canDoorRelease !== technician.canDoorRelease ||
      operationsDraft.canInternal !== technician.canInternal;
    if (!hasChanged) return;

    startTransition(async () => {
      try {
        await updateTechnician(technician.id, operationsDraft);
      } catch {
        showToast('Não foi possível salvar as operações. Tente novamente.', 'error');
      }
    });
  }

  const operationOptions = [
    { key: 'canField', label: OS_VISUALS.field.label },
    { key: 'canDelivery', label: OS_VISUALS.delivery.label },
    { key: 'canPickup', label: OS_VISUALS.pickup.label },
    { key: 'canDoorRelease', label: OS_VISUALS.door.label },
    { key: 'canInternal', label: OS_VISUALS.internal.label },
  ] as const;

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`group rounded-card border border-dashed p-3 ease-out-quart ${
        isAbsent ? 'bg-absent/6' : 'bg-canvas'
      } ${
        draggable && sortable.isDragging
          ? // Mesmo motivo do card individual: transform aqui é do dnd-kit.
            'border-brand shadow-drag transition-[border-color,box-shadow,opacity] duration-200 will-change-transform'
          : `${isAbsent ? 'border-absent/40' : 'border-line-strong'} transition-[border-color,box-shadow,transform,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-card`
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div
        className="mb-2 h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={totalOS}
        aria-valuemin={0}
        aria-valuemax={sharedLimit}
        aria-label={`Carga da dupla: ${totalOS} de ${sharedLimit} OS`}
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out-quart ${
            isOverLimit
              ? 'bg-danger'
              : percentage >= 80
                ? 'bg-warn'
                : isAbsent
                  ? 'bg-absent'
                  : 'bg-brand'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mb-2 flex items-start gap-2">
        {draggable ? (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-1 shrink-0 cursor-grab rounded text-ink-subtle opacity-60 transition-opacity duration-150 hover:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            title="Arrastar dupla"
            aria-label="Arrastar dupla"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="mt-1 h-4 w-4 shrink-0 rounded-full border border-line bg-surface/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge tone="brand">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Dupla
            </Badge>
            {isAbsent && <Badge tone="absent">Ausente</Badge>}
            {supportCity && isSupportActive && (
              <Badge tone="support">Apoio {supportCity.name}</Badge>
            )}
            {draggable && (
              <span className="ml-auto">
                <MoveMenu cellId={cell.id} label="a dupla" disabled={readOnly} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Membros fora do recuo do puxador: com o recuo, o nome quebrava no
          meio da palavra na coluna de 280px. */}
      <div className="mb-2 space-y-1.5">
        {cell.technicians.map((technician) => (
          <div
            key={technician.id}
            className="rounded-control border border-line bg-surface-raised px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 wrap-break-word text-sm font-semibold leading-5 text-ink">
                {technician.name}
              </p>
              <Badge tone={technician.type === 'CLT' ? 'clt' : 'ter'}>{technician.type}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="mr-auto min-w-0 truncate text-xs text-ink-subtle">
                {formatTechnicianCode(technician.code)}
              </p>
              {isSupervisor && (
                <ChipButton
                  active={editingOperationsForId === technician.id}
                  onClick={() => openOperationsEditor(technician.id)}
                  disabled={readOnly}
                  title={`Editar operações de ${technician.name}`}
                >
                  Operações
                </ChipButton>
              )}
              {isSupervisor && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(technician.id, technician.name)}
                  className="shrink-0 rounded p-0.5 text-ink-subtle transition-[color,transform] duration-150 hover:text-danger active:scale-90"
                  title={`Remover ${technician.name}`}
                  aria-label={`Remover ${technician.name}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>

            {editingOperationsForId === technician.id && (
              <div className="mt-2 animate-pop rounded-control border border-line-strong bg-canvas/60 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {operationOptions.map((option) => (
                    <OperationCheckbox
                      key={option.key}
                      label={option.label}
                      checked={operationsDraft[option.key]}
                      onChange={(checked) =>
                        setOperationsDraft((current) => ({ ...current, [option.key]: checked }))
                      }
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingOperationsForId(null)}
                    className="rounded-control border border-line-strong px-2 py-1 text-[11px] text-ink-subtle transition-[color,border-color,transform] duration-150 hover:text-ink active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveOperationsEditor}
                    className="rounded-control bg-brand px-2 py-1 text-[11px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-strong active:scale-95"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`grid gap-2 ${osBlocks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {osBlocks.map((block) => (
          <OSField
            key={block.key}
            label={OS_VISUALS[block.visual].label}
            value={block.value}
            readOnly={readOnly}
            isEditing={editingField === block.key}
            inputRef={editingField === block.key ? inputRef : undefined}
            onChange={(value) => setLocalValue(block.key, value)}
            onDoubleClick={() => handleDoubleClick(block.key)}
            onBlur={(value) => handleBlur(block.key, value)}
            onKeyDown={(event) => handleKeyDown(event, block.key, getLocalValue(block.key))}
            onStep={(delta) => handleStep(block.key, delta)}
            color={block.visual}
          />
        ))}
      </div>

      <div className="mt-2 border-t border-line pt-2 text-xs text-ink-subtle">
        <div className="flex items-center gap-2">
          <span
            className={`tabular shrink-0 rounded-control border px-2 py-0.5 transition-colors duration-200 ${
              isOverLimit
                ? 'border-danger/40 bg-danger/10 text-danger'
                : isAbsent
                  ? 'border-absent/40 bg-absent/10 text-absent'
                  : 'border-line-strong bg-surface/70 text-ink-muted'
            }`}
            title="OS da dupla / menor limite entre os dois"
          >
            {totalOS}/{sharedLimit}
          </span>

          {isOverLimit && (
            <span
              className="flex shrink-0 animate-pop items-center gap-1 whitespace-nowrap text-[11px] font-medium text-danger"
              title="OS acima do limite"
            >
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z"
                />
              </svg>
              acima do limite
            </span>
          )}
        </div>

        {isAbsent && representative && (
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="absent">{getAbsenceLabel(representative.absenceReason)}</Badge>
            <select
              value={representative.absenceReason ?? ''}
              onChange={(event) => handleAbsenceReasonChange(event.target.value)}
              disabled={readOnly}
              className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink transition-colors hover:border-brand/50 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Motivo da ausência da dupla"
            >
              <option value="">Sem motivo</option>
              {ABSENCE_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {greenArea && !isAbsent && (
          <GreenAreaPicker
            selected={representative?.areas ?? []}
            onToggle={handleToggleArea}
            onClear={() => handleSetAreas([])}
            disabled={readOnly}
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {supportCity && canToggleSupport && (
            <ChipButton
              tone="support"
              active={isSupportActive}
              onClick={handleSupportToggle}
              disabled={Boolean(supportRestrictionReason) || isAbsent || readOnly}
              title={
                supportRestrictionReason ??
                (isSupportActive
                  ? `Remover apoio da dupla (${supportCity.name})`
                  : `Escalar dupla para ${supportCity.name}`)
              }
            >
              {isSupportActive ? 'Apoio' : 'Escalar'}
            </ChipButton>
          )}

          <ChipButton
            onClick={handleUngroup}
            disabled={isPending || readOnly}
            title="Desfazer a dupla neste dia"
          >
            Separar
          </ChipButton>
        </div>
      </div>
    </div>
  );
}
