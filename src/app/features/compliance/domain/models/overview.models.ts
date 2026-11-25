// El resumen de cumplimiento de un servicio (contracts/modules/compliance-overview.md, MD-137). Un bloque por marco contratado; las categorías son los criterios de
// confianza en alcance. La API manda conteos: los porcentajes los calcula la pantalla (`percentOf`, D80). `technical` solo llega en la vista técnica.

export type OverviewReadiness = 'ready' | 'almost_ready' | 'needs_work' | 'not_measured';
/** El estado que calcula el motor para un marco o una categoría (`rollup_state`, enums.md). */
export type RollupState = 'compliant' | 'non_compliant' | 'evaluating' | 'no_controls' | 'out_of_scope';

export interface OverviewRatio {
  done: number;
  total: number;
}

export interface OverviewCoverage {
  measured: number;
  applicable: number;
}

export type FailingAffected = { kind: 'asset'; id: string; name: string } | { kind: 'test'; id: string; display_name: string };

export interface OverviewFailingControl {
  control_id: string;
  /** El código con el que se nombra el control (D80): el del catálogo o el propio. */
  code: string;
  requirement_codes: string[];
  own_code: string | null;
  name: string;
  readiness: string;
  failing: { dimension: string; affected: FailingAffected[] }[];
}

export interface OverviewTechnicalControl {
  control_id: string;
  control_code: string;
  progress: OverviewRatio;
}

export interface OverviewCategory {
  trust_criterion: string;
  readiness: string;
  progress: OverviewRatio;
  coverage: OverviewCoverage;
  failing_controls: OverviewFailingControl[];
  technical?: { state: RollupState; controls: OverviewTechnicalControl[] };
}

export interface OverviewEvaluation {
  catalog_version: string | null;
  period_start: string | null;
  period_end: string | null;
  /** La fecha de corte con la que se evalúa (D87): la congelada o, si no hay, hoy. Nula solo si no hay período. */
  cutoff_date: string | null;
  /** `true` si la fecha de corte está congelada; `false` si es «hoy». Nulo si no hay período. */
  cutoff_frozen: boolean | null;
  /** Los meses mínimos del período auditado del marco (PR-16; SOC 2: 6). `null` = sin mínimo. Llega aunque el período no esté definido. */
  min_period_months?: number | null;
}

/** Lo que se manda para declarar el período de un marco (`PUT …/evaluation-period`, D87). `cutoff_date` en `null` = «hoy» (y descongela). */
export interface EvaluationPeriodBody {
  period_start: string;
  period_end: string;
  cutoff_date: string | null;
}

export interface EvaluationPeriodResult {
  framework_code: string;
  catalog_version: string;
  period_start: string;
  period_end: string;
  cutoff_date: string;
  cutoff_frozen: boolean;
}

/** Un período auditado de un servicio × marco (`GET …/evaluation-periods`, D145, D148): el abierto y los cerrados, que no cambian. */
export interface EvaluationPeriodItem {
  id: string;
  status: 'open' | 'closed';
  period_start: string;
  period_end: string;
  cutoff_date: string | null;
  opened_by: 'user' | 'system';
  closed_at: string | null;
}

export interface OverviewFramework {
  framework_code: string;
  name: string;
  readiness: string;
  progress: OverviewRatio;
  coverage: OverviewCoverage;
  evaluation: OverviewEvaluation;
  categories: OverviewCategory[];
  technical?: {
    state: RollupState;
    unique_controls: number;
    failing: string[];
    pending: string[];
  };
}

export interface ComplianceOverview {
  service_id: string;
  frameworks: OverviewFramework[];
}
