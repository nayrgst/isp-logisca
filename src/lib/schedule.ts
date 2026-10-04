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

export function isValidDateKey(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  // Rejeita datas que o Date.UTC "conserta", como 2026-02-31.
  return parsed !== null && parsed.toISOString().slice(0, 10) === dateKey;
}

// Domingo tem escala reduzida (plantão). A partir desta data, todo domingo
// ainda não mexido começa com todos em Ausente, e os supervisores puxam só
// quem está de plantão — em vez de tirar um por um para Ausente.
const SUNDAY_ALL_ABSENT_FROM = '2026-10-11';

export function startsWithEveryoneAbsent(dateKey: string | null | undefined) {
  if (!dateKey || !isValidDateKey(dateKey) || dateKey < SUNDAY_ALL_ABSENT_FROM) return false;
  return parseDateKey(dateKey)!.getUTCDay() === 0;
}

type UnplannedDayFields = {
  cityId: string | null;
  supportCityId: string | null;
  onLeave: boolean;
  onPickup: boolean;
  sharedCellId: string | null;
  osField: number;
  osDelivery: number;
  osPickup: number;
  osDoorRelease: number;
  osInternal: number;
};

/* Como o técnico aparece num dia que ainda não tem plano próprio. Em dia
   comum é o cadastro (lotação/dupla padrão). Em domingo de plantão é Ausente,
   sem dupla, apoio ou OS. Tudo que cria o plano de um dia parte daqui — senão
   mexer na OS de alguém no domingo o "devolveria" à cidade do cadastro. */
export function getUnplannedDayState<T extends UnplannedDayFields>(
  technician: T,
  dateKey: string | null | undefined
): T {
  if (!startsWithEveryoneAbsent(dateKey)) return technician;

  return {
    ...technician,
    cityId: null,
    supportCityId: null,
    onLeave: true,
    onPickup: false,
    sharedCellId: null,
    osField: 0,
    osDelivery: 0,
    osPickup: 0,
    osDoorRelease: 0,
    osInternal: 0,
  };
}

export function shouldUseDailySchedule(regional: Regional, dateKey?: string | null) {
  if (!Object.values(Regional).includes(regional) || !dateKey) {
    return false;
  }

  return isValidDateKey(dateKey);
}

export function normalizeSelectedDate(dateKey?: string | null, todayDateKey = getTodayDateKey()) {
  if (dateKey && isValidDateKey(dateKey)) {
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
