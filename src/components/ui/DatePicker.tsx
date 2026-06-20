'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string; // "YYYY-MM-DD"
  onChange: (dateKey: string) => void;
  todayDateKey?: string;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function parseKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) };
}

function toKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplay(value: string) {
  const parsed = parseKey(value);
  if (!parsed) return 'Selecionar data';
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.monthIndex + 1).padStart(2, '0')}/${parsed.year}`;
}

export function DatePicker({ value, onChange, todayDateKey }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = parseKey(value);
  const today = todayDateKey ? parseKey(todayDateKey) : null;

  const [view, setView] = useState(() => {
    const base = selected ?? today ?? { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
    return { year: base.year, monthIndex: base.monthIndex };
  });

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && selected) {
      setView({ year: selected.year, monthIndex: selected.monthIndex });
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const daysInMonth = new Date(view.year, view.monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.monthIndex, 1).getDay();

  function goToMonth(delta: number) {
    setView((current) => {
      const date = new Date(current.year, current.monthIndex + delta, 1);
      return { year: date.getFullYear(), monthIndex: date.getMonth() };
    });
  }

  function selectDay(day: number) {
    onChange(toKey(view.year, view.monthIndex, day));
    setOpen(false);
  }

  function isSameDay(target: { year: number; monthIndex: number } & { day?: number }, day: number) {
    return target.year === view.year && target.monthIndex === view.monthIndex && target.day === day;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white transition-colors hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {formatDisplay(value)}
        <svg
          className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl shadow-black/40">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Mês anterior"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-white">
              {MONTHS[view.monthIndex]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Próximo mês"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={`${weekday}-${index}`}
                className="flex h-7 items-center justify-center text-[11px] font-medium text-slate-500"
              >
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span key={`empty-${index}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const isSelected = selected ? isSameDay(selected, day) : false;
              const isToday = today ? isSameDay(today, day) : false;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 font-medium text-white'
                      : isToday
                        ? 'border border-indigo-500/60 text-indigo-300 hover:bg-slate-800'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {todayDateKey && (
            <div className="mt-3 border-t border-slate-800 pt-2">
              <button
                type="button"
                onClick={() => {
                  onChange(todayDateKey);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-slate-800"
              >
                Hoje
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
