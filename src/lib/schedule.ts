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
