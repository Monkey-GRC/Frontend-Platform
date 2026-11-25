// El resumen de la empresa en el Inicio: cuántos servicios, activos, controles, riesgos y causas tiene, y cómo va el cumplimiento de cada servicio por marco. El cumplimiento se
// mide por servicio × marco (D62, D68): nunca existe un número de toda la empresa, así que no hay una «calificación» única, sino una por cada servicio y marco.

export interface DashboardFramework {
  code: string;
  name: string;
  /** El semáforo de cuatro niveles (`ready`, `almost_ready`, `needs_work`, `not_measured`). */
  readiness: string;
  /** El veredicto del motor (`compliant`, `non_compliant`, `evaluating`…); solo llega en la vista técnica. */
  verdict: string | null;
  progress: { done: number; total: number };
  coverage: { measured: number; applicable: number };
  /** ¿Ya se definió el período auditado? Sin él el marco queda «Sin medir» y el paso del onboarding «Definir su período auditado» sigue pendiente. */
  periodDefined: boolean;
}

export interface DashboardAttention {
  controlId: string;
  code: string;
  name: string;
}

export interface DashboardServiceSummary {
  id: string;
  name: string;
  frameworks: DashboardFramework[];
  /** Conteos del servicio; `null` si no se pudieron leer (la llamada falló o no trajo `total`): se muestra «—», nunca un 0 inventado ni NaN. */
  assets: number | null;
  /** Los controles del servicio: el mayor total entre sus marcos (un control compartido cuenta una vez). */
  controls: number;
  risks: number | null;
  risksEvaluated: number | null;
  causes: number | null;
  failing: DashboardAttention[];
}

export interface Dashboard {
  services: DashboardServiceSummary[];
}
