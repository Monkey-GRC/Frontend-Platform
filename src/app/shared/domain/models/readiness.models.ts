// Nivel de preparación (enums.md · `readiness`). Es cualitativo: Preparado, Casi listo, Requiere trabajo y Sin medir.
// `not_measured` NO es un fallo: es un hueco de cobertura (D68), así que nunca se muestra como «Requiere trabajo».
export const READINESS_LEVELS = ['ready', 'almost_ready', 'needs_work', 'not_measured'] as const;

export type Readiness = (typeof READINESS_LEVELS)[number];

export function isReadiness(value: unknown): value is Readiness {
  return typeof value === 'string' && (READINESS_LEVELS as readonly string[]).includes(value);
}

// Lo que no se reconoce se trata como «sin medir»: ante la duda nunca se pinta un fallo que no existe.
export function toReadiness(value: unknown): Readiness {
  return isReadiness(value) ? value : 'not_measured';
}
