// Sub-áreas cobertas pela "Área Verde" (DF02).
export const GREEN_AREAS: Array<{ value: string; label: string }> = [
  { value: 'Riacho Fundo 1', label: 'Riacho' },
  { value: 'Taguatinga', label: 'Taguatinga' },
  { value: 'Vicente Pires', label: 'Vicente' },
  { value: 'Águas Claras', label: 'Águas Claras' },
  { value: 'Núcleo Bandeirante', label: 'Núcleo' },
  { value: 'Guará 1 e 2', label: 'Guará' },
];

const GREEN_AREA_LABELS = new Map(GREEN_AREAS.map((area) => [area.value, area.label]));

export function isGreenAreaCityName(name: string | null | undefined) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes('area verde') || lower.includes('área verde');
}

export function isGreenAreaValue(value: string) {
  return GREEN_AREA_LABELS.has(value);
}

// Resumo curto das sub-áreas, ex.: "Núcleo + Riacho".
export function summarizeGreenAreas(areas: string[]) {
  const labels = areas
    .filter((area) => GREEN_AREA_LABELS.has(area))
    .map((area) => GREEN_AREA_LABELS.get(area)!);
  return labels.length > 0 ? labels.join(' + ') : 'Sem área';
}
