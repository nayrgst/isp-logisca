import type { Regional, TechnicianType } from '@prisma/client';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const SERRA_DOURADA_NAME = 'serra dourada';
const SERRA_DOURADA_BLOCKED_TECHNICIANS = [
  'roni',
  'roberto carlos',
  'emanuel',
  'gustavo',
];

export function isSerraDouradaCityName(name: string) {
  return normalizeText(name).startsWith(SERRA_DOURADA_NAME);
}

export function getSupportRestrictionReason(params: {
  technicianName: string;
  supportCityName: string;
  regional: Regional;
  technicianType: TechnicianType;
}) {
  const { technicianName, supportCityName, regional, technicianType } = params;

  if (!isSerraDouradaCityName(supportCityName)) {
    return null;
  }

  if (regional === 'DF03' && technicianType === 'TER') {
    return 'Na DF03, técnicos terceiros não entram na escala de Serra Dourada.';
  }

  const normalizedTechnicianName = normalizeText(technicianName);

  return SERRA_DOURADA_BLOCKED_TECHNICIANS.some((blockedName) =>
    normalizedTechnicianName.startsWith(blockedName)
  )
    ? 'Esse técnico não entra na escala de Serra Dourada.'
    : null;
}
