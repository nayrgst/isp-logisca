export type AbsenceReason =
  | 'FERIAS'
  | 'FOLGA'
  | 'ATESTADO'
  | 'AFASTADO'
  | 'FALTA'
  | 'CARRO_QUEBRADO'
  | 'TREINAMENTO'
  | 'SUSPENSAO'
  | 'LICENCA';

export const ABSENCE_REASONS: Array<{ value: AbsenceReason; label: string }> = [
  { value: 'FERIAS', label: 'Férias' },
  { value: 'FOLGA', label: 'Folga' },
  { value: 'ATESTADO', label: 'Atestado' },
  { value: 'AFASTADO', label: 'Afastado' },
  { value: 'FALTA', label: 'Falta' },
  { value: 'CARRO_QUEBRADO', label: 'Carro quebrado' },
  { value: 'TREINAMENTO', label: 'Treinamento' },
  { value: 'SUSPENSAO', label: 'Suspensão' },
  { value: 'LICENCA', label: 'Licença' },
];

const REASON_LABELS = new Map(ABSENCE_REASONS.map((reason) => [reason.value, reason.label]));

export function isAbsenceReason(value: string | null | undefined): value is AbsenceReason {
  return typeof value === 'string' && REASON_LABELS.has(value as AbsenceReason);
}

export function getAbsenceLabel(value: string | null | undefined) {
  if (isAbsenceReason(value)) return REASON_LABELS.get(value)!;
  return 'Sem motivo';
}
