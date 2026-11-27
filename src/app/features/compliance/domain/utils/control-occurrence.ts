import type { ControlDetail } from '../models/control.models';

/**
 * Prueba → requisito «cuando ocurra» (`on_demand`) al que sirve: la evidencia de una prueba así se entrega por caso (`occurrence_id`, DT-115).
 * Solo cuentan las pruebas de `management.manual_tests[]` (las manuales NO documentales): la prueba documental no admite `occurrence_id` (422 `occurrence_id.invalid`, gestion.md),
 * aunque su requisito sea «cuando sea requerido». Y solo si el requisito trae su trimestre (`on_demand`), que el backend llena cuando alguna de sus pruebas no es documental.
 */
export function onDemandRequirementsByTest(detail: ControlDetail): Map<string, string> {
  const onDemand = new Set(detail.management.requirements.filter((r) => r.on_demand !== null).map((r) => r.id));
  const out = new Map<string, string>();
  for (const t of detail.management.manual_tests) if (t.requirement_id && onDemand.has(t.requirement_id)) out.set(t.test.id, t.requirement_id);
  return out;
}
