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

export function getSupportRestrictionReason(technicianName: string, supportCityName: string) {
  if (!isSerraDouradaCityName(supportCityName)) {
    return null;
  }

  const normalizedTechnicianName = normalizeText(technicianName);

  return SERRA_DOURADA_BLOCKED_TECHNICIANS.some((blockedName) =>
    normalizedTechnicianName.startsWith(blockedName)
  )
    ? 'Esse técnico não entra na escala de Serra Dourada.'
    : null;
}
