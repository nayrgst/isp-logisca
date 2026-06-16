import { Regional } from '@prisma/client';

const SCHEDULE_TIMEZONE = 'America/Sao_Paulo';

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function getTodayDateKey() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export function getScheduleBounds() {
  return {
    minDate: undefined,
    maxDate: undefined,
  };
}

export function isCurrentWeekDate(dateKey: string) {
  return parseDateKey(dateKey) !== null;
}

export function isEditableScheduleDate(dateKey: string) {
  return parseDateKey(dateKey) !== null;
}

export function shouldUseDailySchedule(regional: Regional, dateKey?: string | null) {
  if (!Object.values(Regional).includes(regional) || !dateKey) {
    return false;
  }

  return parseDateKey(dateKey) !== null;
}

export function normalizeSelectedDate(dateKey?: string | null, todayDateKey = getTodayDateKey()) {
  if (dateKey && parseDateKey(dateKey)) {
    return dateKey;
  }

  return todayDateKey;
}

export function formatDateKeyBR(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function getCurrentMonthRange(todayDateKey = getTodayDateKey()) {
  const [year, month] = todayDateKey.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endExclusive = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const label = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SCHEDULE_TIMEZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return { start, endExclusive, label };
}
