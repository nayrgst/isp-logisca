'use client';

import { useRef, useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  updateTechnicianCode,
  updateTechnicianOS,
  updateTechnicianPair,
  updateTechnicianSupportCity,
} from '@/app/actions/technician';
import type { TechnicianWithCity } from '@/types';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';
import { getSupportRestrictionReason } from '@/lib/support';

interface Props {
  technician: TechnicianWithCity;
  isSupervisor: boolean;
  onDelete?: (id: string) => void;
  dragId?: string;
  draggable?: boolean;
  embedded?: boolean;
  pairCandidates?: TechnicianWithCity[];
  supportCity?: { id: string; name: string } | null;
}

type EditableField = 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease';

export function TechnicianCard({
  technician,
  isSupervisor,
  onDelete,
  dragId,
  draggable = true,
  embedded = false,
  pairCandidates = [],
  supportCity = null,
}: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [isEditingPair, setIsEditingPair] = useState(false);
  const [osField, setOsField] = useState(technician.osField);
  const [osDelivery, setOsDelivery] = useState(technician.osDelivery);
  const [osPickup, setOsPickup] = useState(technician.osPickup);
  const [osDoorRelease, setOsDoorRelease] = useState(technician.osDoorRelease);
  const [codeDraft, setCodeDraft] = useState(
    hasVisibleTechnicianCode(technician.code) ? technician.code : ''
  );
  const [pairDraft, setPairDraft] = useState('__SOLO__');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const pairSelectRef = useRef<HTMLSelectElement>(null);

  const sortable = useSortable({
    id: dragId ?? technician.id,
    data: {
      type: 'cell',
      technicianIds: [technician.id],
    },
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
    zIndex: sortable.isDragging ? 999 : undefined,
  };

  const totalOS =
    (technician.canField ? osField : 0) +
    (technician.canDelivery ? osDelivery : 0) +
    (technician.canPickup ? osPickup : 0) +
    (technician.canDoorRelease ? osDoorRelease : 0);
  const percentage = technician.osLimit > 0 ? Math.min(100, (totalOS / technician.osLimit) * 100) : 0;
  const isOverLimit = totalOS > technician.osLimit;
  const hasVisibleCode = hasVisibleTechnicianCode(technician.code);
  const currentPartner =
    technician.sharedCellId
      ? pairCandidates.find((candidate) => candidate.sharedCellId === technician.sharedCellId) ?? null
      : null;
  const isSupportActive = supportCity ? technician.supportCityId === supportCity.id : false;
  const canToggleSupport = Boolean(supportCity) && technician.cityId !== supportCity?.id;
  const supportRestrictionReason = supportCity
    ? getSupportRestrictionReason(technician.name, supportCity.name)
    : null;

  function handleDoubleClick(field: EditableField) {
    setEditingField(field);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function handleCodeDoubleClick() {
    setIsEditingCode(true);
    setTimeout(() => codeInputRef.current?.select(), 10);
  }

  function handlePairClick() {
    setPairDraft(currentPartner?.id ?? '__SOLO__');
    setIsEditingPair(true);
    setTimeout(() => pairSelectRef.current?.focus(), 10);
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
    const previousValue = getOriginalValue(field);
    if (value === previousValue) return;

    startTransition(async () => {
      try {
        await updateTechnicianOS(technician.id, field, value);
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

  function handleCodeBlur() {
    const previousCode = hasVisibleTechnicianCode(technician.code) ? technician.code : '';
    setIsEditingCode(false);
    if (codeDraft.trim() === previousCode) return;

    startTransition(async () => {
      try {
        await updateTechnicianCode(technician.id, codeDraft);
      } catch {
        setCodeDraft(previousCode);
      }
    });
  }

  function handleCodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') handleCodeBlur();
    if (event.key === 'Escape') {
      setIsEditingCode(false);
      setCodeDraft(hasVisibleTechnicianCode(technician.code) ? technician.code : '');
    }
  }

  function handlePairSave() {
    setIsEditingPair(false);
    const nextPartnerId = pairDraft === '__SOLO__' ? null : pairDraft;

    if ((currentPartner?.id ?? null) === nextPartnerId) return;

    startTransition(async () => {
      try {
        await updateTechnicianPair(technician.id, nextPartnerId);
      } catch {
        setPairDraft(currentPartner?.id ?? '__SOLO__');
      }
    });
  }

  function handlePairKeyDown(event: React.KeyboardEvent<HTMLSelectElement>) {
    if (event.key === 'Enter') handlePairSave();
    if (event.key === 'Escape') {
      setIsEditingPair(false);
      setPairDraft(currentPartner?.id ?? '__SOLO__');
    }
  }

  function handleSupportToggle() {
    if (!supportCity || !canToggleSupport || supportRestrictionReason) return;

    startTransition(async () => {
      try {
        await updateTechnicianSupportCity(technician.id, isSupportActive ? null : supportCity.id);
      } catch {
        // Refresh-driven UI keeps the last persisted state.
      }
    });
  }

  const cardStatusClasses = technician.onLeave
    ? 'border-orange-600/60 bg-orange-950/20'
    : embedded
      ? 'border-gray-700/60 bg-gray-900/60'
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
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`select-none rounded-xl border px-3 py-2.5 transition-all duration-150 ${cardStatusClasses} ${
        draggable && sortable.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:border-gray-600'
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
        {draggable ? (
          <button
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-1 shrink-0 cursor-grab text-gray-600 hover:text-gray-400 active:cursor-grabbing"
            title="Arrastar técnico"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="mt-1 h-4 w-4 shrink-0 rounded-full border border-gray-700 bg-gray-900/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="wrap-break-word text-sm font-semibold leading-5 text-white">
                {technician.name}
              </div>
              {isEditingCode ? (
                <input
                  ref={codeInputRef}
                  value={codeDraft}
                  onChange={(event) => setCodeDraft(event.target.value)}
                  onBlur={handleCodeBlur}
                  onKeyDown={handleCodeKeyDown}
                  placeholder="Sem codigo"
                  className="mt-0.5 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={handleCodeDoubleClick}
                  className={`mt-0.5 text-left text-xs ${
                    hasVisibleCode ? 'text-gray-500' : 'italic text-gray-600'
                  }`}
                  title="Clique duas vezes para editar o código"
                >
                  {formatTechnicianCode(technician.code)}
                </button>
              )}
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
            {isSupportActive && supportCity && (
              <span className="rounded-md bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Apoio {supportCity.name}
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
            onKeyDown={(event) => handleKeyDown(event, block.key, getLocalValue(block.key))}
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

        {!embedded && supportCity && canToggleSupport && (
          <button
            type="button"
            onClick={handleSupportToggle}
            disabled={Boolean(supportRestrictionReason) || technician.onLeave}
            className={`ml-2 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
              isSupportActive
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-600'
                : 'border-gray-700/70 text-gray-400 hover:border-gray-600 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            title={supportRestrictionReason ?? (isSupportActive ? 'Remover apoio' : `Escalar para ${supportCity.name}`)}
          >
            {isSupportActive ? `Apoio ${supportCity.name}` : `Escalar ${supportCity.name}`}
          </button>
        )}

        {isEditingPair && !embedded ? (
          <div className="ml-auto flex items-center gap-1">
            <select
              ref={pairSelectRef}
              value={pairDraft}
              onChange={(event) => setPairDraft(event.target.value)}
              onBlur={handlePairSave}
              onKeyDown={handlePairKeyDown}
              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="__SOLO__">Individual</option>
              {pairCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.sharedCellId && candidate.sharedCellId !== technician.sharedCellId
                    ? ' • em dupla'
                    : ''}
                </option>
              ))}
            </select>
          </div>
        ) : !embedded ? (
          <button
            type="button"
            onClick={handlePairClick}
            className="ml-auto rounded-md border border-gray-700/70 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
            title={currentPartner ? `Dupla com ${currentPartner.name}` : 'Criar dupla'}
          >
            {currentPartner ? 'Dupla ativa' : 'Criar dupla'}
          </button>
        ) : null}

        {isSupervisor && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(technician.id)}
            className={`${!embedded ? 'ml-2' : 'ml-auto'} text-gray-600 transition-colors hover:text-red-400`}
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
  onChange: (value: number) => void;
  onDoubleClick: () => void;
  onBlur: (value: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
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
