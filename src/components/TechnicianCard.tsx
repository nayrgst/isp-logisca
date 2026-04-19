'use client';

import { useRef, useState, useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { updateTechnicianOS, toggleTechnicianStatus } from '@/app/actions/technician';
import type { TechnicianWithCity } from '@/types';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';

interface Props {
  technician: TechnicianWithCity;
  isSupervisor: boolean;
  onDelete?: (id: string) => void;
}

export function TechnicianCard({ technician, isSupervisor, onDelete }: Props) {
  const [editingField, setEditingField] = useState<'osField' | 'osDelivery' | null>(null);
  const [osField, setOsField] = useState(technician.osField);
  const [osDelivery, setOsDelivery] = useState(technician.osDelivery);
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

  const totalOS = technician.type === 'CLT' ? osField + osDelivery : osDelivery;
  const percentage = Math.min(100, (totalOS / technician.osLimit) * 100);
  const isOverLimit = totalOS > technician.osLimit;
  const isCLT = technician.type === 'CLT';
  const hasVisibleCode = hasVisibleTechnicianCode(technician.code);

  function handleDoubleClick(field: 'osField' | 'osDelivery') {
    setEditingField(field);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function handleBlur(field: 'osField' | 'osDelivery', value: number) {
    setEditingField(null);
    const prev = field === 'osField' ? technician.osField : technician.osDelivery;
    if (value === prev) return;

    startTransition(async () => {
      try {
        await updateTechnicianOS(technician.id, field, value);
      } catch {
        if (field === 'osField') setOsField(technician.osField);
        else setOsDelivery(technician.osDelivery);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, field: 'osField' | 'osDelivery', value: number) {
    if (e.key === 'Enter') handleBlur(field, value);
    if (e.key === 'Escape') {
      setEditingField(null);
      if (field === 'osField') setOsField(technician.osField);
      else setOsDelivery(technician.osDelivery);
    }
  }

  const statusColors = {
    normal: 'border-gray-700 bg-gray-800',
    leave: 'border-yellow-600/50 bg-yellow-950/30',
    pickup: 'border-purple-600/50 bg-purple-950/30',
  };

  const cardStatus = technician.onLeave ? 'leave' : technician.onPickup ? 'pickup' : 'normal';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-3 transition-all duration-150 select-none
        ${statusColors[cardStatus]}
        ${isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:border-gray-600'}
        ${isPending ? 'opacity-70' : ''}
      `}
    >
      {/* Header: drag handle + name + code */}
      <div className="flex items-start gap-2 mb-2.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
          title="Arrastar técnico"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-white text-sm truncate">{technician.name}</span>
            <span
              className={`text-xs ${hasVisibleCode ? 'text-gray-500' : 'text-gray-600 italic'}`}
            >
              {formatTechnicianCode(technician.code)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded-md
              ${isCLT ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}
            >
              {technician.type}
            </span>
            {technician.onLeave && (
              <span className="text-xs bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded-md">
                Folga
              </span>
            )}
            {technician.onPickup && (
              <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded-md">
                Retirada
              </span>
            )}
          </div>
        </div>

        {/* Total OS Badge */}
        <div
          className={`shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg
          ${isOverLimit ? 'bg-red-900/50 border border-red-700' : 'bg-gray-700/50 border border-gray-600'}`}
        >
          <span
            className={`text-base font-bold leading-none ${isOverLimit ? 'text-red-400' : 'text-white'}`}
          >
            {totalOS}
          </span>
          <span className="text-gray-500 text-[10px]">/{technician.osLimit}</span>
        </div>
      </div>

      {/* OS Inputs */}
      <div className={`grid gap-2 ${isCLT ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {isCLT && (
          <OSField
            label="Field"
            value={osField}
            isEditing={editingField === 'osField'}
            inputRef={editingField === 'osField' ? inputRef : undefined}
            onChange={setOsField}
            onDoubleClick={() => handleDoubleClick('osField')}
            onBlur={(v) => handleBlur('osField', v)}
            onKeyDown={(e) => handleKeyDown(e, 'osField', osField)}
            color="blue"
            pending={isPending}
          />
        )}
        <OSField
          label="Delivery"
          value={osDelivery}
          isEditing={editingField === 'osDelivery'}
          inputRef={editingField === 'osDelivery' ? inputRef : undefined}
          onChange={setOsDelivery}
          onDoubleClick={() => handleDoubleClick('osDelivery')}
          onBlur={(v) => handleBlur('osDelivery', v)}
          onKeyDown={(e) => handleKeyDown(e, 'osDelivery', osDelivery)}
          color="green"
          pending={isPending}
        />
      </div>

      {/* Progress Bar */}
      <div className="mt-2.5">
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300
              ${isOverLimit ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Status toggles (supervisor only) */}
      {isSupervisor && (
        <div className="flex gap-2 mt-2.5 pt-2 border-t border-gray-700/50">
          <StatusToggle
            label="Folga"
            active={technician.onLeave}
            onClick={() =>
              startTransition(async () => {
                await toggleTechnicianStatus(technician.id, 'onLeave', !technician.onLeave);
              })
            }
            color="yellow"
          />
          <StatusToggle
            label="Retirada"
            active={technician.onPickup}
            onClick={() =>
              startTransition(async () => {
                await toggleTechnicianStatus(technician.id, 'onPickup', !technician.onPickup);
              })
            }
            color="purple"
          />
          {onDelete && (
            <button
              onClick={() => onDelete(technician.id)}
              className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
              title="Remover técnico"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface OSFieldProps {
  label: string;
  value: number;
  isEditing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (v: number) => void;
  onDoubleClick: () => void;
  onBlur: (v: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  color: 'blue' | 'green';
  pending?: boolean;
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
  pending = false,
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
  };
  const c = colors[color];

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-2`}>
      <div className="flex items-center gap-1 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">
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
          className={`w-full bg-transparent text-lg font-bold ${c.text} focus:outline-none border-b border-current`}
          autoFocus
        />
      ) : (
        <button
          type="button"
          className={`flex w-full items-center justify-between gap-2 text-left ${pending ? 'opacity-70' : ''}`}
          onClick={onDoubleClick}
          title="Clique no lapis para editar"
        >
          <div className={`text-lg font-bold ${c.text}`}>
            {value}
            <span className="text-gray-600 text-xs ml-1">OS</span>
          </div>
          <span className="rounded-md border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
            Editar
          </span>
        </button>
      )}
    </div>
  );
}

interface StatusToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color: 'yellow' | 'purple';
}

function StatusToggle({ label, active, onClick, color }: StatusToggleProps) {
  const colors = {
    yellow: active
      ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
      : 'bg-gray-800 text-gray-500 border-gray-700',
    purple: active
      ? 'bg-purple-900/50 text-purple-300 border-purple-700'
      : 'bg-gray-800 text-gray-500 border-gray-700',
  };
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded-md border transition-all ${colors[color]}`}
    >
      {label}
    </button>
  );
}
