import { Regional } from '@prisma/client';

const SCHEDULE_TIMEZONE = 'America/Sao_Paulo';

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getScheduleWindow(todayDateKey = getTodayDateKey()) {
  const today = parseDateKey(todayDateKey);
  if (!today) return null;

  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

  return {
    start,
    end,
  };
}

export function getScheduleBounds(todayDateKey = getTodayDateKey()) {
  const window = getScheduleWindow(todayDateKey);
  if (!window) return null;

  return {
    minDate: toDateKey(window.start),
    maxDate: toDateKey(window.end),
  };
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

export function isCurrentWeekDate(dateKey: string, todayDateKey = getTodayDateKey()) {
  const parsed = parseDateKey(dateKey);
  const window = getScheduleWindow(todayDateKey);
  if (!parsed || !window) return false;

  return parsed >= window.start && parsed <= window.end;
}

export function isEditableScheduleDate(dateKey: string, todayDateKey = getTodayDateKey()) {
  return isCurrentWeekDate(dateKey, todayDateKey);
}

export function shouldUseDailySchedule(regional: Regional, dateKey?: string | null) {
  if (!Object.values(Regional).includes(regional) || !dateKey) return false;
  return isCurrentWeekDate(dateKey);
}

export function normalizeSelectedDate(dateKey?: string | null, todayDateKey = getTodayDateKey()) {
  if (dateKey && isCurrentWeekDate(dateKey, todayDateKey)) {
    return dateKey;
  }

  return todayDateKey;
}
