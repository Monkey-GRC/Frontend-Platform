import type { StatusTone } from '@shared/domain/models/status-tone.model';

// Estado del control en la vista técnica (enums.md `control_state`): cada valor, un tono de estado. El color nunca va solo (el texto va en el badge);
// «sin pruebas» y un valor desconocido son neutros: no hay dato, no es un fallo.
const TONES: Record<string, StatusTone> = {
  effective: 'ok',
  ineffective: 'bad',
  error: 'bad',
  expired: 'warn',
  incomplete: 'warn',
  evaluating: 'info',
  no_tests: 'neutral',
};

/** Tono de un `control_state`; un valor que no conoce sale neutro. */
export function controlStateTone(state: string | null | undefined): StatusTone {
  return TONES[state ?? ''] ?? 'neutral';
}
