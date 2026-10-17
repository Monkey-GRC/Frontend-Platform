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
  assets: number;
  /** Los controles del servicio: el mayor total entre sus marcos (un control compartido cuenta una vez). */
  controls: number;
  risks: number;
  risksEvaluated: number;
  causes: number;
  failing: DashboardAttention[];
}

export interface Dashboard {
  services: DashboardServiceSummary[];
}
