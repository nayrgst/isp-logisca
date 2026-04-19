const INTERNAL_CODE_PREFIX = 'AUTO-';

export function createInternalTechnicianCode() {
  return `${INTERNAL_CODE_PREFIX}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function hasVisibleTechnicianCode(code: string | null | undefined) {
  return Boolean(code && !code.startsWith(INTERNAL_CODE_PREFIX));
}

export function formatTechnicianCode(code: string | null | undefined) {
  return hasVisibleTechnicianCode(code) ? `[${code}]` : 'Sem codigo';
}
