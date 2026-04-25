'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTransition } from 'react';
import { updateTechnicianPair } from '@/app/actions/technician';
import { TechnicianCard } from '@/components/TechnicianCard';
import type { TechnicianCell, TechnicianWithCity } from '@/types';

interface Props {
  cell: TechnicianCell;
  isSupervisor: boolean;
  onDelete?: (id: string, name: string) => void;
  draggable?: boolean;
}

export function TechnicianGroupCard({ cell, isSupervisor, onDelete, draggable = true }: Props) {
  const [isPending, startTransition] = useTransition();
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

  const pairCandidatesFor = (technician: TechnicianWithCity) =>
    cell.technicians.filter((candidate) => candidate.id !== technician.id);

  function handleUngroup() {
    startTransition(async () => {
      await updateTechnicianPair(cell.technicians[0].id, null);
    });
  }

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={draggable ? style : undefined}
      className={`rounded-2xl border border-dashed border-gray-700/80 bg-gray-950/40 p-2 transition-all ${
        draggable && sortable.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:border-gray-600'
      }`}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        {draggable ? (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="cursor-grab text-gray-600 hover:text-gray-400 active:cursor-grabbing"
            title="Arrastar dupla"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        ) : (
          <div className="h-4 w-4 rounded-full border border-gray-700 bg-gray-900/40" />
        )}
        <span className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Dupla</span>
        <span className="ml-auto text-[11px] text-gray-600">{cell.technicians.length} técnicos</span>
        <button
          type="button"
          onClick={handleUngroup}
          disabled={isPending}
          className="rounded-md border border-gray-700/70 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50"
        >
          Separar
        </button>
      </div>

      <div className="space-y-2">
        {cell.technicians.map((technician) => (
          <TechnicianCard
            key={technician.id}
            technician={technician}
            isSupervisor={isSupervisor}
            draggable={false}
            embedded={true}
            pairCandidates={pairCandidatesFor(technician)}
            onDelete={onDelete ? (id) => onDelete(id, technician.name) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
