// D89 · Antes de declarar los activos de un servicio hay que evaluar sus riesgos: la probabilidad y el impacto cambian de un servicio a otro, y de ahí sale la matriz
// inherente (y, después, la residual). Esta es la ÚNICA regla de «cuántos faltan»: la usan la pantalla de riesgos, el detalle del servicio y el guard de las rutas de conexión.

export interface RiskProgress {
  /** Los riesgos vigentes del servicio. */
  total: number;
  /** Los que ya tienen probabilidad e impacto. */
  evaluated: number;
  /** Los que faltan. */
  pending: number;
  /** ¿Se puede pasar a declarar activos? Sí cuando no falta ninguno. Un servicio sin riesgos vigentes no se bloquea: no hay nada que evaluar. */
  ready: boolean;
}

/** Sin evaluar = `null` en probabilidad o en impacto (no 0): lo define cada empresa (MD-123). Un riesgo dado de baja no cuenta. */
export function riskProgress(risks: readonly { is_active: boolean; likelihood: number | null; impact: number | null }[]): RiskProgress {
  const active = risks.filter((r) => r.is_active);
  const evaluated = active.filter((r) => r.likelihood !== null && r.impact !== null).length;
  const pending = active.length - evaluated;
  return { total: active.length, evaluated, pending, ready: pending === 0 };
}

interface Scored { likelihood: number | null; impact: number | null }
const isEvaluated = (r: Scored) => r.likelihood !== null && r.impact !== null;

/** El primer riesgo sin evaluar, para empezar (o retomar) el asistente donde se quedó; `null` si no falta ninguno. */
export function firstPendingIndex(risks: readonly Scored[]): number | null {
  const i = risks.findIndex((r) => !isEvaluated(r));
  return i === -1 ? null : i;
}

/** El siguiente sin evaluar después de `from`; si no quedan más adelante, el primero que haya quedado atrás; `null` si no falta ninguno. */
export function nextPendingIndex(risks: readonly Scored[], from: number): number | null {
  for (let step = 1; step <= risks.length; step++) {
    const i = (from + step) % risks.length;
    if (!isEvaluated(risks[i])) return i;
  }
  return null;
}