'use client';

import { useRef, useState, useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { updateTechnicianOS } from '@/app/actions/technician';
import type { TechnicianWithCity } from '@/types';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';

interface Props {
  technician: TechnicianWithCity;
  isSupervisor: boolean;
  onDelete?: (id: string) => void;
}

type EditableField = 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease';

export function TechnicianCard({ technician, isSupervisor, onDelete }: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [osField, setOsField] = useState(technician.osField);
  const [osDelivery, setOsDelivery] = useState(technician.osDelivery);
  const [osPickup, setOsPickup] = useState(technician.osPickup);
  const [osDoorRelease, setOsDoorRelease] = useState(technician.osDoorRelease);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: technician.id,
    data: { technician },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const totalOS =
    (technician.canField ? osField : 0) +
    (technician.canDelivery ? osDelivery : 0) +
    (technician.canPickup ? osPickup : 0) +
    (technician.canDoorRelease ? osDoorRelease : 0);
  const percentage = Math.min(100, (totalOS / technician.osLimit) * 100);
  const isOverLimit = totalOS > technician.osLimit;
  const hasVisibleCode = hasVisibleTechnicianCode(technician.code);

  function handleDoubleClick(field: EditableField) {
    setEditingField(field);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function getOriginalValue(field: EditableField) {
    if (field === 'osField') return technician.osField;
    if (field === 'osDelivery') return technician.osDelivery;
    if (field === 'osPickup') return technician.osPickup;
    return technician.osDoorRelease;
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

  function handleBlur(field: EditableField, value: number) {
    setEditingField(null);
    const prev = getOriginalValue(field);
    if (value === prev) return;

    startTransition(async () => {
      try {
        await updateTechnicianOS(technician.id, field, value);
      } catch {
        setLocalValue(field, prev);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, field: EditableField, value: number) {
    if (e.key === 'Enter') handleBlur(field, value);
    if (e.key === 'Escape') {
      setEditingField(null);
      setLocalValue(field, getOriginalValue(field));
    }
  }

  const cardStatusClasses = technician.onLeave
    ? 'border-orange-600/60 bg-orange-950/20'
    : 'border-gray-700 bg-gray-800';

  const osBlocks = [
    technician.canField
      ? { key: 'osField' as const, label: 'Field', value: osField, color: 'blue' as const }
      : null,
    technician.canDelivery
      ? {
          key: 'osDelivery' as const,
          label: 'Delivery',
          value: osDelivery,
          color: 'green' as const,
        }
      : null,
    technician.canPickup
      ? {
          key: 'osPickup' as const,
          label: 'Retirada',
          value: osPickup,
          color: 'purple' as const,
        }
      : null,
    technician.canDoorRelease
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`select-none rounded-xl border px-3 py-2.5 transition-all duration-150 ${cardStatusClasses} ${
        isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:border-gray-600'
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-700/70">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOverLimit
              ? 'bg-red-500'
              : percentage >= 80
                ? 'bg-yellow-500'
                : technician.onLeave
                  ? 'bg-orange-400'
                  : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mb-2 flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 cursor-grab text-gray-600 hover:text-gray-400 active:cursor-grabbing"
          title="Arrastar técnico"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="wrap-break-word text-sm font-semibold leading-5 text-white">
                {technician.name}
              </div>
              <div
                className={`mt-0.5 text-xs ${hasVisibleCode ? 'text-gray-500' : 'italic text-gray-600'}`}
              >
                {formatTechnicianCode(technician.code)}
              </div>
            </div>

            <div className="shrink-0 pt-0.5">
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

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {technician.onLeave && (
              <span className="rounded-md bg-orange-900/40 px-1.5 py-0.5 text-[10px] text-orange-300">
                Ausente
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-2 ${osBlocks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {osBlocks.map((block) => (
          <OSField
            key={block.key}
            label={block.label}
            value={block.value}
            isEditing={editingField === block.key}
            inputRef={editingField === block.key ? inputRef : undefined}
            onChange={(value) => setLocalValue(block.key, value)}
            onDoubleClick={() => handleDoubleClick(block.key)}
            onBlur={(value) => handleBlur(block.key, value)}
            onKeyDown={(e) => handleKeyDown(e, block.key, getLocalValue(block.key))}
            color={block.color}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center border-t border-gray-700/50 pt-2 text-xs text-gray-500">
        <span
          className={`rounded-md border px-2 py-0.5 ${
            isOverLimit
              ? 'border-red-700/60 bg-red-950/30 text-red-400'
              : technician.onLeave
                ? 'border-orange-700/60 bg-orange-950/30 text-orange-300'
                : 'border-gray-700 bg-gray-900/70 text-gray-300'
          }`}
        >
          {totalOS}/{technician.osLimit}
        </span>

        {isSupervisor && onDelete && (
          <button
            onClick={() => onDelete(technician.id)}
            className="ml-auto text-gray-600 transition-colors hover:text-red-400"
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

interface OSFieldProps {
  label: string;
  value: number;
  isEditing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (v: number) => void;
  onDoubleClick: () => void;
  onBlur: (v: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  color: 'blue' | 'green' | 'purple' | 'cyan';
}

function OSField({
  label,
  value,
  isEditing,
  inputRef,
  onChange,
  onDoubleClick,
  onBlur,
  onKeyDown,
  color,
}: OSFieldProps) {
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
  const c = colors[color];

  return (
    <div className={`${c.bg} rounded-lg border ${c.border} px-3 py-2`}>
      <div className="mb-1 flex items-center gap-1">
        <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={99}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          onBlur={() => onBlur(value)}
          onKeyDown={onKeyDown}
          className={`w-full border-b border-current bg-transparent text-lg font-bold ${c.text} focus:outline-none`}
          autoFocus
        />
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onDoubleClick={onDoubleClick}
          title="Clique duas vezes para editar"
        >
          <div className={`text-lg font-bold ${c.text}`}>
            {value}
            <span className="ml-1 text-xs text-gray-600">OS</span>
          </div>
        </button>
      )}
    </div>
  );
}
