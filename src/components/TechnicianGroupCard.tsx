'use client';

import { useRef, useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  updateTechnician,
  updateTechnicianGroupOS,
  updateTechnicianGroupSupportCity,
  updateTechnicianPair,
} from '@/app/actions/technician';
import { formatTechnicianCode } from '@/lib/technician';
import { getSupportRestrictionReason } from '@/lib/support';
import type { TechnicianCell } from '@/types';

type EditableField = 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease';

interface Props {
  cell: TechnicianCell;
  isSupervisor: boolean;
  onDelete?: (id: string, name: string) => void;
  draggable?: boolean;
  supportCity?: { id: string; name: string } | null;
  scheduleDate?: string | null;
  readOnly?: boolean;
}

export function TechnicianGroupCard({
  cell,
  isSupervisor,
  onDelete,
  draggable = true,
  supportCity = null,
  scheduleDate = null,
  readOnly = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editingOperationsForId, setEditingOperationsForId] = useState<string | null>(null);
  const [operationsDraft, setOperationsDraft] = useState({
    canField: false,
    canDelivery: false,
    canPickup: false,
    canDoorRelease: false,
  });
  const [osField, setOsField] = useState(cell.technicians[0]?.osField ?? 0);
  const [osDelivery, setOsDelivery] = useState(cell.technicians[0]?.osDelivery ?? 0);
  const [osPickup, setOsPickup] = useState(cell.technicians[0]?.osPickup ?? 0);
  const [osDoorRelease, setOsDoorRelease] = useState(cell.technicians[0]?.osDoorRelease ?? 0);
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
  const serverOsKey = `${representative?.osField ?? 0}|${representative?.osDelivery ?? 0}|${representative?.osPickup ?? 0}|${representative?.osDoorRelease ?? 0}`;
  const [lastServerOsKey, setLastServerOsKey] = useState(serverOsKey);
  if (serverOsKey !== lastServerOsKey && editingField === null) {
    setLastServerOsKey(serverOsKey);
    setOsField(representative?.osField ?? 0);
    setOsDelivery(representative?.osDelivery ?? 0);
    setOsPickup(representative?.osPickup ?? 0);
    setOsDoorRelease(representative?.osDoorRelease ?? 0);
    if (dirtyFields.size > 0) setDirtyFields(new Set());
  }

  const showsLocal = (field: EditableField) => editingField === field || dirtyFields.has(field);
  const resolvedOsField = showsLocal('osField') ? osField : representative?.osField ?? 0;
  const resolvedOsDelivery = showsLocal('osDelivery') ? osDelivery : representative?.osDelivery ?? 0;
  const resolvedOsPickup = showsLocal('osPickup') ? osPickup : representative?.osPickup ?? 0;
  const resolvedOsDoorRelease = showsLocal('osDoorRelease')
    ? osDoorRelease
    : representative?.osDoorRelease ?? 0;
  const sharedLimit = Math.min(...cell.technicians.map((technician) => technician.osLimit));
  const totalOS =
    (representative?.canField ? resolvedOsField : 0) +
    (representative?.canDelivery ? resolvedOsDelivery : 0) +
    (representative?.canPickup ? resolvedOsPickup : 0) +
    (representative?.canDoorRelease ? resolvedOsDoorRelease : 0);
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

  const osBlocks = [
    representative?.canField
      ? { key: 'osField' as const, label: 'Field', value: resolvedOsField, color: 'blue' as const }
      : null,
    representative?.canDelivery
      ? {
          key: 'osDelivery' as const,
          label: 'Delivery',
          value: resolvedOsDelivery,
          color: 'green' as const,
        }
      : null,
    representative?.canPickup
      ? {
          key: 'osPickup' as const,
          label: 'Retirada',
          value: resolvedOsPickup,
          color: 'purple' as const,
        }
      : null,
    representative?.canDoorRelease
      ? {
          key: 'osDoorRelease' as const,
          label: 'Lib. porta',
          value: resolvedOsDoorRelease,
          color: 'cyan' as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: EditableField;
    label: string;
    value: number;
    color: 'blue' | 'green' | 'purple' | 'cyan';
  }>;

  function getOriginalValue(field: EditableField) {
    if (field === 'osField') return representative?.osField ?? 0;
    if (field === 'osDelivery') return representative?.osDelivery ?? 0;
    if (field === 'osPickup') return representative?.osPickup ?? 0;
    return representative?.osDoorRelease ?? 0;
  }

  function setLocalValue(field: EditableField, value: number) {
    if (field === 'osField') setOsField(value);
    else if (field === 'osDelivery') setOsDelivery(value);
    else if (field === 'osPickup') setOsPickup(value);
    else setOsDoorRelease(value);
  }

  function getLocalValue(field: EditableField) {
    if (field === 'osField') return osField;
    if (field === 'osDelivery') return osDelivery;
    if (field === 'osPickup') return osPickup;
    return osDoorRelease;
  }

  function handleStep(field: EditableField, delta: number) {
    if (readOnly || !representative) return;
    const current = showsLocal(field) ? getLocalValue(field) : getOriginalValue(field);
    const next = Math.max(0, current + delta);
    if (next === current) return;

    setLocalValue(field, next);
    setDirtyFields((prev) => new Set(prev).add(field));

    startTransition(async () => {
      try {
        await updateTechnicianGroupOS(representative.id, field, next, scheduleDate);
      } catch {
        setLocalValue(field, getOriginalValue(field));
        setDirtyFields((prev) => {
          const updated = new Set(prev);
          updated.delete(field);
          return updated;
        });
      }
    });
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

    startTransition(async () => {
      try {
        await updateTechnicianGroupOS(representative.id, field, value, scheduleDate);
      } catch {
        setLocalValue(field, previousValue);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent, field: EditableField, value: number) {
    if (event.key === 'Enter') handleBlur(field, value);
    if (event.key === 'Escape') {
      setEditingField(null);
      setLocalValue(field, getOriginalValue(field));
    }
  }

  function handleUngroup() {
    startTransition(async () => {
      await updateTechnicianPair(representative.id, null, scheduleDate);
    });
  }

  function handleSupportToggle() {
    if (!supportCity || supportRestrictionReason) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupSupportCity(
          representative.id,
          isSupportActive ? null : supportCity.id,
          scheduleDate
        );
      } catch {
        // Refresh-driven UI keeps the persisted state.
      }
    });
  }

  function openOperationsEditor(technicianId: string) {
    const technician = cell.technicians.find((member) => member.id === technicianId);
    if (!technician || readOnly) return;
    setEditingOperationsForId(technicianId);
    setOperationsDraft({
      canField: technician.canField,
      canDelivery: technician.canDelivery,
      canPickup: technician.canPickup,
      canDoorRelease: technician.canDoorRelease,
    });
  }

  function closeOperationsEditor() {
    setEditingOperationsForId(null);
  }

  function saveOperationsEditor() {
    if (!editingOperationsForId) return;
    const technician = cell.technicians.find((member) => member.id === editingOperationsForId);
    if (!technician) {
      closeOperationsEditor();
      return;
    }

    const hasChanged =
      operationsDraft.canField !== technician.canField ||
      operationsDraft.canDelivery !== technician.canDelivery ||
      operationsDraft.canPickup !== technician.canPickup ||
      operationsDraft.canDoorRelease !== technician.canDoorRelease;

    closeOperationsEditor();
    if (!hasChanged) return;

    startTransition(async () => {
      await updateTechnician(technician.id, operationsDraft);
    });
  }

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-3 transition-all ${
        draggable && sortable.isDragging ? 'shadow-2xl ring-2 ring-indigo-500' : 'hover:border-slate-600'
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-slate-700/70">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOverLimit ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mb-3 flex items-start gap-2">
        {draggable ? (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-1 cursor-grab text-slate-600 hover:text-slate-400 active:cursor-grabbing"
            title="Arrastar dupla"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="mt-1 h-4 w-4 rounded-full border border-slate-700 bg-slate-900/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="min-w-0 truncate text-sm font-semibold text-white">
              {cell.technicians.map((technician) => technician.name).join(' + ')}
            </span>
            <span className="shrink-0 rounded-md border border-slate-700/70 px-1.5 py-0.5 text-[10px] text-slate-400">
              Dupla
            </span>
            {supportCity && isSupportActive && (
              <span className="shrink-0 rounded-md bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Apoio {supportCity.name}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {cell.technicians.map((technician) => (
              <div
                key={technician.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{technician.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatTechnicianCode(technician.code)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        technician.type === 'CLT'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-orange-900/50 text-orange-300'
                      }`}
                    >
                      {technician.type}
                    </span>
                    {isSupervisor && (
                      <button
                        type="button"
                        onClick={() => openOperationsEditor(technician.id)}
                        disabled={readOnly}
                        className="rounded-md border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Operações
                      </button>
                    )}
                  </div>
                </div>

                {editingOperationsForId === technician.id && (
                  <div className="mt-2 rounded-lg border border-slate-700/70 bg-slate-950/60 p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <OperationCheckbox
                        label="Field"
                        checked={operationsDraft.canField}
                        onChange={(checked) =>
                          setOperationsDraft((current) => ({ ...current, canField: checked }))
                        }
                      />
                      <OperationCheckbox
                        label="Delivery"
                        checked={operationsDraft.canDelivery}
                        onChange={(checked) =>
                          setOperationsDraft((current) => ({ ...current, canDelivery: checked }))
                        }
                      />
                      <OperationCheckbox
                        label="Retirada"
                        checked={operationsDraft.canPickup}
                        onChange={(checked) =>
                          setOperationsDraft((current) => ({ ...current, canPickup: checked }))
                        }
                      />
                      <OperationCheckbox
                        label="Lib. porta"
                        checked={operationsDraft.canDoorRelease}
                        onChange={(checked) =>
                          setOperationsDraft((current) => ({ ...current, canDoorRelease: checked }))
                        }
                      />
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeOperationsEditor}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveOperationsEditor}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-2 ${osBlocks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {osBlocks.map((block) => (
          <GroupOSField
            key={block.key}
            label={block.label}
            value={block.value}
            readOnly={readOnly}
            isEditing={editingField === block.key}
            inputRef={editingField === block.key ? inputRef : undefined}
            onChange={(value) => setLocalValue(block.key, value)}
            onDoubleClick={() => handleDoubleClick(block.key)}
            onBlur={(value) => handleBlur(block.key, value)}
            onKeyDown={(event) => handleKeyDown(event, block.key, getLocalValue(block.key))}
            onStep={(delta) => handleStep(block.key, delta)}
            color={block.color}
          />
        ))}
      </div>

      <div className="mt-3 border-t border-slate-700/50 pt-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 ${
              isOverLimit
                ? 'border-red-700/60 bg-red-950/30 text-red-400'
                : 'border-slate-700 bg-slate-900/70 text-slate-300'
            }`}
          >
            {totalOS}/{sharedLimit}
          </span>

          {isOverLimit && (
            <span
              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-red-400"
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

        <div className="mt-2 flex flex-wrap items-center gap-2">
        {supportCity && (
          <button
            type="button"
            onClick={handleSupportToggle}
            disabled={Boolean(supportRestrictionReason) || readOnly}
            className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
              isSupportActive
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-600'
                : 'border-slate-700/70 text-slate-400 hover:border-slate-600 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            title={
              supportRestrictionReason ??
              (isSupportActive ? `Remover apoio da dupla (${supportCity.name})` : `Escalar dupla para ${supportCity.name}`)
            }
          >
            {isSupportActive ? 'Apoio' : 'Escalar'}
          </button>
        )}

        <button
          type="button"
          onClick={handleUngroup}
          disabled={isPending || readOnly}
          className="ml-auto shrink-0 whitespace-nowrap rounded-md border border-slate-700/70 px-2 py-0.5 text-[11px] text-slate-400 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          Separar
        </button>

        {isSupervisor && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(representative.id, representative.name)}
            className="shrink-0 text-slate-600 transition-colors hover:text-red-400"
            title="Remover técnico"
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
      </div>
    </div>
  );
}

interface GroupOSFieldProps {
  label: string;
  value: number;
  readOnly: boolean;
  isEditing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (value: number) => void;
  onDoubleClick: () => void;
  onBlur: (value: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onStep: (delta: number) => void;
  color: 'blue' | 'green' | 'purple' | 'cyan';
}

function GroupOSField({
  label,
  value,
  readOnly,
  isEditing,
  inputRef,
  onChange,
  onDoubleClick,
  onBlur,
  onKeyDown,
  onStep,
  color,
}: GroupOSFieldProps) {
  const colors = {
    blue: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-800/40',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
    },
    green: {
      bg: 'bg-green-900/20',
      border: 'border-green-800/40',
      text: 'text-green-400',
      dot: 'bg-green-500',
    },
    purple: {
      bg: 'bg-purple-900/20',
      border: 'border-purple-800/40',
      text: 'text-purple-400',
      dot: 'bg-purple-500',
    },
    cyan: {
      bg: 'bg-cyan-900/20',
      border: 'border-cyan-800/40',
      text: 'text-cyan-400',
      dot: 'bg-cyan-500',
    },
  };
  const currentColor = colors[color];

  return (
    <div className={`${currentColor.bg} rounded-lg border ${currentColor.border} px-3 py-2`}>
      <div className="mb-1 flex items-center gap-1">
        <div className={`h-1.5 w-1.5 rounded-full ${currentColor.dot}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(parseInt(event.target.value, 10) || 0)}
          onBlur={() => onBlur(value)}
          onKeyDown={onKeyDown}
          className={`w-full border-b border-current bg-transparent text-lg font-bold ${currentColor.text} focus:outline-none`}
          autoFocus
        />
      ) : (
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={readOnly || value <= 0}
            aria-label={`Diminuir ${label}`}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${currentColor.border} text-base leading-none ${currentColor.text} transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30`}
          >
            −
          </button>
          <button
            type="button"
            onDoubleClick={onDoubleClick}
            title={readOnly ? 'Dia bloqueado para edição' : 'Clique duas vezes para digitar um valor'}
            className={`text-lg font-bold ${currentColor.text}`}
          >
            {value}
            <span className="ml-1 text-xs text-slate-600">OS</span>
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={readOnly}
            aria-label={`Aumentar ${label}`}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${currentColor.border} text-base leading-none ${currentColor.text} transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function OperationCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[11px] text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
      />
      <span>{label}</span>
    </label>
  );
}
