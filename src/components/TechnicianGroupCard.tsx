'use client';

import { useRef, useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
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
}

export function TechnicianGroupCard({
  cell,
  isSupervisor,
  onDelete,
  draggable = true,
  supportCity = null,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [osField, setOsField] = useState(cell.technicians[0]?.osField ?? 0);
  const [osDelivery, setOsDelivery] = useState(cell.technicians[0]?.osDelivery ?? 0);
  const [osPickup, setOsPickup] = useState(cell.technicians[0]?.osPickup ?? 0);
  const [osDoorRelease, setOsDoorRelease] = useState(cell.technicians[0]?.osDoorRelease ?? 0);
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
  const sharedLimit = Math.min(...cell.technicians.map((technician) => technician.osLimit));
  const totalOS =
    (representative?.canField ? osField : 0) +
    (representative?.canDelivery ? osDelivery : 0) +
    (representative?.canPickup ? osPickup : 0) +
    (representative?.canDoorRelease ? osDoorRelease : 0);
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
      ? { key: 'osField' as const, label: 'Field', value: osField, color: 'blue' as const }
      : null,
    representative?.canDelivery
      ? {
          key: 'osDelivery' as const,
          label: 'Delivery',
          value: osDelivery,
          color: 'green' as const,
        }
      : null,
    representative?.canPickup
      ? {
          key: 'osPickup' as const,
          label: 'Retirada',
          value: osPickup,
          color: 'purple' as const,
        }
      : null,
    representative?.canDoorRelease
      ? {
          key: 'osDoorRelease' as const,
          label: 'Lib. porta',
          value: osDoorRelease,
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

  function handleDoubleClick(field: EditableField) {
    setEditingField(field);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function handleBlur(field: EditableField, value: number) {
    setEditingField(null);
    const previousValue = getOriginalValue(field);
    if (value === previousValue) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupOS(representative.id, field, value);
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
      await updateTechnicianPair(representative.id, null);
    });
  }

  function handleSupportToggle() {
    if (!supportCity || supportRestrictionReason) return;

    startTransition(async () => {
      try {
        await updateTechnicianGroupSupportCity(representative.id, isSupportActive ? null : supportCity.id);
      } catch {
        // Refresh-driven UI keeps the persisted state.
      }
    });
  }

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`rounded-2xl border border-dashed border-gray-700/80 bg-gray-950/40 p-3 transition-all ${
        draggable && sortable.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:border-gray-600'
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-700/70">
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
            className="mt-1 cursor-grab text-gray-600 hover:text-gray-400 active:cursor-grabbing"
            title="Arrastar dupla"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="mt-1 h-4 w-4 rounded-full border border-gray-700 bg-gray-900/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Dupla</span>
            <span className="rounded-md border border-gray-700/70 px-1.5 py-0.5 text-[10px] text-gray-400">
              {cell.technicians.length} técnicos
            </span>
            {supportCity && isSupportActive && (
              <span className="rounded-md bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Apoio {supportCity.name}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {cell.technicians.map((technician) => (
              <div
                key={technician.id}
                className="rounded-xl border border-gray-800/80 bg-gray-900/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{technician.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatTechnicianCode(technician.code)}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      technician.type === 'CLT'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-orange-900/50 text-orange-300'
                    }`}
                  >
                    {technician.type}
                  </span>
                </div>
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
            isEditing={editingField === block.key}
            inputRef={editingField === block.key ? inputRef : undefined}
            onChange={(value) => setLocalValue(block.key, value)}
            onDoubleClick={() => handleDoubleClick(block.key)}
            onBlur={(value) => handleBlur(block.key, value)}
            onKeyDown={(event) => handleKeyDown(event, block.key, getLocalValue(block.key))}
            color={block.color}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center border-t border-gray-700/50 pt-2 text-xs text-gray-500">
        <span
          className={`rounded-md border px-2 py-0.5 ${
            isOverLimit
              ? 'border-red-700/60 bg-red-950/30 text-red-400'
              : 'border-gray-700 bg-gray-900/70 text-gray-300'
          }`}
        >
          {totalOS}/{sharedLimit}
        </span>

        {supportCity && (
          <button
            type="button"
            onClick={handleSupportToggle}
            disabled={Boolean(supportRestrictionReason)}
            className={`ml-2 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
              isSupportActive
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-600'
                : 'border-gray-700/70 text-gray-400 hover:border-gray-600 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            title={
              supportRestrictionReason ??
              (isSupportActive ? 'Remover apoio da dupla' : `Escalar dupla para ${supportCity.name}`)
            }
          >
            {isSupportActive ? `Apoio ${supportCity.name}` : `Escalar ${supportCity.name}`}
          </button>
        )}

        <button
          type="button"
          onClick={handleUngroup}
          disabled={isPending}
          className="ml-auto rounded-md border border-gray-700/70 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50"
        >
          Separar
        </button>

        {isSupervisor && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(representative.id, representative.name)}
            className="ml-2 text-gray-600 transition-colors hover:text-red-400"
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
  );
}

interface GroupOSFieldProps {
  label: string;
  value: number;
  isEditing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (value: number) => void;
  onDoubleClick: () => void;
  onBlur: (value: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  color: 'blue' | 'green' | 'purple' | 'cyan';
}

function GroupOSField({
  label,
  value,
  isEditing,
  inputRef,
  onChange,
  onDoubleClick,
  onBlur,
  onKeyDown,
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
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
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onDoubleClick={onDoubleClick}
          title="Clique duas vezes para editar"
        >
          <div className={`text-lg font-bold ${currentColor.text}`}>
            {value}
            <span className="ml-1 text-xs text-gray-600">OS</span>
          </div>
        </button>
      )}
    </div>
  );
}
