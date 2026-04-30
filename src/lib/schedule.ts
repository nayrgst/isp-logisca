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

  const sundayOffset = -today.getUTCDay();
  const currentSunday = new Date(today);
  currentSunday.setUTCDate(today.getUTCDate() + sundayOffset);

  const nextSaturday = new Date(currentSunday);
  nextSaturday.setUTCDate(currentSunday.getUTCDate() + 13);

  return {
    start: currentSunday,
    end: nextSaturday,
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
  if (regional !== Regional.DF02 || !dateKey) return false;
  return isCurrentWeekDate(dateKey);
}

export function getWeekOptions(todayDateKey = getTodayDateKey()) {
  const window = getScheduleWindow(todayDateKey);
  if (!window) return [];

  const labelFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SCHEDULE_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

  return Array.from({ length: 14 }, (_, index) => {
    const optionDate = new Date(window.start);
    optionDate.setUTCDate(window.start.getUTCDate() + index);
    const dateKey = toDateKey(optionDate);

    return {
      dateKey,
      label: labelFormatter
        .format(optionDate)
        .replace('.', '')
        .replace(/^\w/, (char) => char.toUpperCase()),
      isToday: dateKey === todayDateKey,
      isEditable: isEditableScheduleDate(dateKey, todayDateKey),
    };
  });
}

export function normalizeSelectedDate(dateKey?: string | null, todayDateKey = getTodayDateKey()) {
  if (dateKey && isCurrentWeekDate(dateKey, todayDateKey)) {
    return dateKey;
  }

  return todayDateKey;
}
