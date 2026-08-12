'use client';

import { useRef, useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  updateTechnician,
  updateTechnicianAbsenceReason,
  updateTechnicianAreas,
  updateTechnicianCode,
  updateTechnicianOS,
  updateTechnicianPair,
  updateTechnicianSupportCity,
} from '@/app/actions/technician';
import type { TechnicianWithCity } from '@/types';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';
import { getSupportRestrictionReason } from '@/lib/support';
import { ABSENCE_REASONS, getAbsenceLabel } from '@/lib/absence';
import { OS_VISUALS, type OSVisualKey } from '@/lib/osVisuals';
import { Badge } from '@/components/ui/Badge';
import { ChipButton } from '@/components/ui/ChipButton';
import { GreenAreaPicker } from '@/components/ui/GreenAreaPicker';
import { useToast } from '@/components/ui/Toast';

interface Props {
  technician: TechnicianWithCity;
  isSupervisor: boolean;
  onDelete?: (id: string) => void;
  dragId?: string;
  draggable?: boolean;
  embedded?: boolean;
  pairCandidates?: TechnicianWithCity[];
  supportCity?: { id: string; name: string } | null;
  scheduleDate?: string | null;
  readOnly?: boolean;
  greenArea?: boolean;
}

type EditableField = 'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease' | 'osInternal';

export function TechnicianCard({
  technician,
  isSupervisor,
  onDelete,
  dragId,
  draggable = true,
  embedded = false,
  pairCandidates = [],
  supportCity = null,
  scheduleDate = null,
  readOnly = false,
  greenArea = false,
}: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [isEditingPair, setIsEditingPair] = useState(false);
  const [isEditingOperations, setIsEditingOperations] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(String(technician.osLimit));
  const [osField, setOsField] = useState(technician.osField);
  const [osDelivery, setOsDelivery] = useState(technician.osDelivery);
  const [osPickup, setOsPickup] = useState(technician.osPickup);
  const [osDoorRelease, setOsDoorRelease] = useState(technician.osDoorRelease);
  const [osInternal, setOsInternal] = useState(technician.osInternal);
  const [operationsDraft, setOperationsDraft] = useState({
    canField: technician.canField,
    canDelivery: technician.canDelivery,
    canPickup: technician.canPickup,
    canDoorRelease: technician.canDoorRelease,
    canInternal: technician.canInternal,
  });
  const [codeDraft, setCodeDraft] = useState(
    hasVisibleTechnicianCode(technician.code) ? technician.code : ''
  );
  const [pairDraft, setPairDraft] = useState('__SOLO__');
  const [dirtyFields, setDirtyFields] = useState<Set<EditableField>>(new Set());
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const pairSelectRef = useRef<HTMLSelectElement>(null);
  const limitInputRef = useRef<HTMLInputElement>(null);

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

  const serverOsKey = `${technician.osField}|${technician.osDelivery}|${technician.osPickup}|${technician.osDoorRelease}|${technician.osInternal}`;
  const [lastServerOsKey, setLastServerOsKey] = useState(serverOsKey);
  if (serverOsKey !== lastServerOsKey && editingField === null) {
    setLastServerOsKey(serverOsKey);
    setOsField(technician.osField);
    setOsDelivery(technician.osDelivery);
    setOsPickup(technician.osPickup);
    setOsDoorRelease(technician.osDoorRelease);
    setOsInternal(technician.osInternal);
    if (dirtyFields.size > 0) setDirtyFields(new Set());
  }

  const showsLocal = (field: EditableField) => editingField === field || dirtyFields.has(field);
  const resolvedOsField = showsLocal('osField') ? osField : technician.osField;
  const resolvedOsDelivery = showsLocal('osDelivery') ? osDelivery : technician.osDelivery;
  const resolvedOsPickup = showsLocal('osPickup') ? osPickup : technician.osPickup;
  const resolvedOsDoorRelease = showsLocal('osDoorRelease') ? osDoorRelease : technician.osDoorRelease;
  const resolvedOsInternal = showsLocal('osInternal') ? osInternal : technician.osInternal;
  const totalOS =
    (technician.canField ? resolvedOsField : 0) +
    (technician.canDelivery ? resolvedOsDelivery : 0) +
    (technician.canPickup ? resolvedOsPickup : 0) +
    (technician.canDoorRelease ? resolvedOsDoorRelease : 0) +
    (technician.canInternal ? resolvedOsInternal : 0);
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
    ? getSupportRestrictionReason({
        technicianName: technician.name,
        supportCityName: supportCity.name,
        regional: technician.regional,
        technicianType: technician.type,
      })
    : null;

  function handleStep(field: EditableField, delta: number) {
    if (readOnly) return;
    const current = showsLocal(field) ? getLocalValue(field) : getOriginalValue(field);
    const next = Math.max(0, current + delta);
    if (next === current) return;

    setLocalValue(field, next);
    setDirtyFields((prev) => new Set(prev).add(field));

    startTransition(async () => {
      try {
        await updateTechnicianOS(technician.id, field, next, scheduleDate);
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

  function handleCodeDoubleClick() {
    setCodeDraft(hasVisibleTechnicianCode(technician.code) ? technician.code : '');
    setIsEditingCode(true);
    setTimeout(() => codeInputRef.current?.select(), 10);
  }

  function handlePairClick() {
    if (readOnly) return;
    setPairDraft(currentPartner?.id ?? '__SOLO__');
    setIsEditingPair(true);
    setTimeout(() => pairSelectRef.current?.focus(), 10);
  }

  function handleLimitEditStart() {
    if (!isSupervisor) return;
    setLimitDraft(String(technician.osLimit));
    setIsEditingLimit(true);
    setTimeout(() => limitInputRef.current?.select(), 10);
  }

  function handleLimitSave() {
    setIsEditingLimit(false);
    const next = Math.max(1, Math.floor(Number(limitDraft) || 0));
    if (next === technician.osLimit) return;

    startTransition(async () => {
      try {
        await updateTechnician(technician.id, { osLimit: next });
      } catch {
        setLimitDraft(String(technician.osLimit));
      }
    });
  }

  function handleLimitKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') handleLimitSave();
    if (event.key === 'Escape') {
      setIsEditingLimit(false);
      setLimitDraft(String(technician.osLimit));
    }
  }

  function handleAbsenceReasonChange(value: string) {
    if (readOnly) return;
    const next = value || null;
    if (next === (technician.absenceReason ?? null)) return;

    startTransition(async () => {
      try {
        await updateTechnicianAbsenceReason(technician.id, next);
      } catch {
        // Refresh-driven UI keeps the persisted state.
      }
    });
  }

  function handleSetAreas(next: string[]) {
    if (readOnly) return;

    startTransition(async () => {
      try {
        await updateTechnicianAreas(technician.id, next);
      } catch {
        showToast('Não foi possível salvar a área. Tente novamente.', 'error');
      }
    });
  }

  function handleToggleArea(area: string) {
    const current = technician.areas ?? [];
    handleSetAreas(
      current.includes(area) ? current.filter((value) => value !== area) : [...current, area]
    );
  }

  function handleOperationsClick() {
    if (readOnly) return;
    setOperationsDraft({
      canField: technician.canField,
      canDelivery: technician.canDelivery,
      canPickup: technician.canPickup,
      canDoorRelease: technician.canDoorRelease,
      canInternal: technician.canInternal,
    });
    setIsEditingOperations((current) => !current);
  }

  function getOriginalValue(field: EditableField) {
    if (field === 'osField') return technician.osField;
    if (field === 'osDelivery') return technician.osDelivery;
    if (field === 'osPickup') return technician.osPickup;
    if (field === 'osInternal') return technician.osInternal;
    return technician.osDoorRelease;
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

  function handleBlur(field: EditableField, value: number) {
    setEditingField(null);
    const previousValue = getOriginalValue(field);
    if (value === previousValue) return;

    startTransition(async () => {
      try {
        await updateTechnicianOS(technician.id, field, value, scheduleDate);
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
        await updateTechnicianPair(technician.id, nextPartnerId, scheduleDate);
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
        await updateTechnicianSupportCity(
          technician.id,
          isSupportActive ? null : supportCity.id,
          scheduleDate
        );
      } catch {
        // Refresh-driven UI keeps the last persisted state.
      }
    });
  }

  function handleOperationsSave() {
    const nextDraft = operationsDraft;
    const hasChanged =
      nextDraft.canField !== technician.canField ||
      nextDraft.canDelivery !== technician.canDelivery ||
      nextDraft.canPickup !== technician.canPickup ||
      nextDraft.canDoorRelease !== technician.canDoorRelease ||
      nextDraft.canInternal !== technician.canInternal;

    setIsEditingOperations(false);
    if (!hasChanged) return;

    startTransition(async () => {
      try {
        await updateTechnician(technician.id, nextDraft);
      } catch {
        setOperationsDraft({
          canField: technician.canField,
          canDelivery: technician.canDelivery,
          canPickup: technician.canPickup,
          canDoorRelease: technician.canDoorRelease,
          canInternal: technician.canInternal,
        });
      }
    });
  }

  const cardStatusClasses = technician.onLeave
    ? 'border-absent/40 bg-absent/6'
    : embedded
      ? 'border-line bg-surface/60'
      : 'border-line bg-surface-raised';

  const osBlocks = [
    technician.canField
      ? {
          key: 'osField' as const,
          label: OS_VISUALS.field.label,
          value: resolvedOsField,
          color: 'field' as const,
        }
      : null,
    technician.canDelivery
      ? {
          key: 'osDelivery' as const,
          label: OS_VISUALS.delivery.label,
          value: resolvedOsDelivery,
          color: 'delivery' as const,
        }
      : null,
    technician.canPickup
      ? {
          key: 'osPickup' as const,
          label: OS_VISUALS.pickup.label,
          value: resolvedOsPickup,
          color: 'pickup' as const,
        }
      : null,
    technician.canDoorRelease
      ? {
          key: 'osDoorRelease' as const,
          label: OS_VISUALS.door.label,
          value: resolvedOsDoorRelease,
          color: 'door' as const,
        }
      : null,
    technician.canInternal
      ? {
          key: 'osInternal' as const,
          label: OS_VISUALS.internal.label,
          value: resolvedOsInternal,
          color: 'internal' as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: EditableField;
    label: string;
    value: number;
    color: OSVisualKey;
  }>;

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`group select-none rounded-card border px-3 py-2.5 ease-out-quart ${cardStatusClasses} ${
        draggable && sortable.isDragging
          ? /* Enquanto arrasta, o transform é do dnd-kit (inline, a cada frame).
               Se ele estiver na lista de transições, cada frame vira uma
               animação de 200ms e o arraste engasga. */
            'shadow-drag transition-[border-color,box-shadow,opacity] duration-200 will-change-transform'
          : 'transition-[border-color,box-shadow,transform,opacity] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card'
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div
        className="mb-2 h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={totalOS}
        aria-valuemin={0}
        aria-valuemax={technician.osLimit}
        aria-label={`Carga: ${totalOS} de ${technician.osLimit} OS`}
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out-quart ${
            isOverLimit
              ? 'bg-danger'
              : percentage >= 80
                ? 'bg-warn'
                : technician.onLeave
                  ? 'bg-absent'
                  : 'bg-brand'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mb-2 flex items-start gap-2">
        {draggable ? (
          <button
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-1 shrink-0 cursor-grab rounded text-ink-subtle opacity-60 transition-opacity duration-150 hover:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            title="Arrastar técnico"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="mt-1 h-4 w-4 shrink-0 rounded-full border border-line bg-surface/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="wrap-break-word text-sm font-semibold leading-5 text-ink">
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
                  className="mt-0.5 w-full rounded-control border border-line-strong bg-surface px-2 py-1 text-xs text-ink transition-[border-color] focus:border-brand focus:outline-none"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={handleCodeDoubleClick}
                  className={`mt-0.5 text-left text-xs transition-colors hover:text-ink ${
                    hasVisibleCode ? 'text-ink-subtle' : 'italic text-ink-subtle'
                  }`}
                  title="Clique duas vezes para editar o código"
                >
                  {formatTechnicianCode(technician.code)}
                </button>
              )}
            </div>

            <div className="shrink-0 pt-0.5">
              <Badge tone={technician.type === 'CLT' ? 'clt' : 'ter'}>{technician.type}</Badge>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {technician.onLeave && <Badge tone="absent">Ausente</Badge>}
            {isSupportActive && supportCity && (
              <Badge tone="support">Apoio {supportCity.name}</Badge>
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

      {isSupervisor && isEditingOperations && (
        <div className="mt-2 animate-pop rounded-control border border-line-strong bg-canvas/60 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Operações
          </p>
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
            <OperationCheckbox
              label="Interno"
              checked={operationsDraft.canInternal}
              onChange={(checked) =>
                setOperationsDraft((current) => ({ ...current, canInternal: checked }))
              }
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditingOperations(false);
                setOperationsDraft({
                  canField: technician.canField,
                  canDelivery: technician.canDelivery,
                  canPickup: technician.canPickup,
                  canDoorRelease: technician.canDoorRelease,
                  canInternal: technician.canInternal,
                });
              }}
              className="rounded-control border border-line-strong px-2 py-1 text-[11px] text-ink-subtle transition-[color,border-color,transform] duration-150 hover:text-ink active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleOperationsSave}
              className="rounded-control bg-brand px-2 py-1 text-[11px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-strong active:scale-95"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-line pt-2 text-xs text-ink-subtle">
        <div className="flex items-center gap-2">
          <span
            className={`tabular flex shrink-0 items-center rounded-control border px-2 py-0.5 transition-colors duration-200 ${
              isOverLimit
                ? 'border-danger/40 bg-danger/10 text-danger'
                : technician.onLeave
                  ? 'border-absent/40 bg-absent/10 text-absent'
                  : 'border-line-strong bg-surface/70 text-ink-muted'
            }`}
          >
            {totalOS}/
            {isEditingLimit ? (
              <input
                ref={limitInputRef}
                type="number"
                min={1}
                value={limitDraft}
                onChange={(event) => setLimitDraft(event.target.value)}
                onBlur={handleLimitSave}
                onKeyDown={handleLimitKeyDown}
                className="ml-0.5 w-12 rounded border border-brand bg-surface px-1 py-0 text-xs text-ink focus:outline-none"
                aria-label="Limite de OS"
              />
            ) : isSupervisor ? (
              <button
                type="button"
                onClick={handleLimitEditStart}
                className="ml-0.5 underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
                title="Clique para alterar o limite de OS"
              >
                {technician.osLimit}
              </button>
            ) : (
              technician.osLimit
            )}
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

        {technician.onLeave && !embedded && (
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="absent">{getAbsenceLabel(technician.absenceReason)}</Badge>
            <select
              value={technician.absenceReason ?? ''}
              onChange={(event) => handleAbsenceReasonChange(event.target.value)}
              disabled={readOnly}
              className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink transition-colors hover:border-brand/50 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Motivo da ausência"
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

        {greenArea && !embedded && !technician.onLeave && (
          <GreenAreaPicker
            selected={technician.areas ?? []}
            onToggle={handleToggleArea}
            onClear={() => handleSetAreas([])}
            disabled={readOnly}
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
        {!embedded && supportCity && canToggleSupport && (
          <ChipButton
            tone="support"
            active={isSupportActive}
            onClick={handleSupportToggle}
            disabled={Boolean(supportRestrictionReason) || technician.onLeave || readOnly}
            title={
              supportRestrictionReason ??
              (isSupportActive ? `Remover apoio (${supportCity.name})` : `Escalar para ${supportCity.name}`)
            }
          >
            {isSupportActive ? 'Apoio' : 'Escalar'}
          </ChipButton>
        )}

        {isEditingPair && !embedded ? (
          <select
            ref={pairSelectRef}
            value={pairDraft}
            onChange={(event) => setPairDraft(event.target.value)}
            onBlur={handlePairSave}
            onKeyDown={handlePairKeyDown}
            className="shrink-0 rounded-control border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink focus:border-brand focus:outline-none"
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
        ) : !embedded ? (
          <ChipButton
            active={Boolean(currentPartner)}
            onClick={handlePairClick}
            disabled={readOnly}
            title={currentPartner ? `Dupla com ${currentPartner.name}` : 'Criar dupla'}
          >
            {currentPartner ? 'Dupla' : 'Criar dupla'}
          </ChipButton>
        ) : null}

        {isSupervisor && !embedded && (
          <ChipButton
            active={isEditingOperations}
            onClick={handleOperationsClick}
            disabled={readOnly}
            title="Editar operações do técnico"
          >
            Operações
          </ChipButton>
        )}

        {isSupervisor && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(technician.id)}
            className="ml-auto shrink-0 rounded p-0.5 text-ink-subtle transition-[color,transform] duration-150 hover:text-danger active:scale-90"
            title="Remover técnico"
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
      </div>
    </div>
  );
}

interface OSFieldProps {
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
  color: OSVisualKey;
}

function OSField({
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
}: OSFieldProps) {
  const visual = OS_VISUALS[color];

  /* O número "bate" a cada mudança. Sem isso, incrementar via stepper não dá
     nenhum retorno visual — o valor simplesmente troca. A key remonta o span,
     o que reinicia a animação. */
  return (
    <div className={`rounded-control border ${visual.surface} ${visual.border} px-3 py-2`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${visual.solid}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
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
          className={`tabular w-full border-b border-current bg-transparent text-lg font-bold ${visual.text} focus:outline-none`}
          autoFocus
        />
      ) : (
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={readOnly || value <= 0}
            aria-label={`Diminuir ${label}`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control border text-base leading-none transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-25 ${visual.border} ${visual.text} hover:bg-white/10`}
          >
            −
          </button>
          <button
            type="button"
            onDoubleClick={onDoubleClick}
            title={readOnly ? 'Dia bloqueado para edição' : 'Clique duas vezes para digitar um valor'}
            className={`tabular text-lg font-bold ${visual.text}`}
          >
            <span key={value} className="inline-block animate-bump">
              {value}
            </span>
            <span className="ml-1 text-xs font-normal text-ink-subtle">OS</span>
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={readOnly}
            aria-label={`Aumentar ${label}`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control border text-base leading-none transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-25 ${visual.border} ${visual.text} hover:bg-white/10`}
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
    <label className="flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface/70 px-2 py-1.5 text-[11px] text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-line-strong bg-canvas accent-brand"
      />
      <span>{label}</span>
    </label>
  );
}
