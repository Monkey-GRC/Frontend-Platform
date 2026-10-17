// Riesgos y causas de un servicio (contracts/modules/compliance-risks.md). Los valores de los enums (criterio, nivel, categoría de falla, tipo de
// pérdida) viajan como `string`: el backend no sirve sus catálogos, así que la pantalla no los enumera; los textos salen del i18n por valor.

export type RiskOrigin = 'catalog' | 'own';

// Un vínculo causa–control. `code` (D80) llega cuando el backend lo mueva a la vista de negocio; mientras tanto se usa `own_code`.
export interface ControlLink {
  control_id: string;
  code?: string | null;
  own_code: string | null;
  name: string;
  is_mandatory: boolean;
  effect: string | null;
  technical?: { catalog_code: string | null };
}

/** El código que identifica al control en un vínculo (D80): el de la vista de negocio, o el técnico si el backend aún lo manda ahí, o el propio (`C01`). */
export function linkCode(l: Pick<ControlLink, 'code' | 'own_code' | 'technical'>): string | null {
  return l.code ?? l.technical?.catalog_code ?? l.own_code ?? null;
}

export interface RiskListItem {
  id: string;
  code: string;
  name: string;
  trust_criterion: string;
  origin: RiskOrigin;
  is_active: boolean;
  // Sin evaluar = `null` (no 0): lo define cada empresa en MD-123.
  likelihood: number | null;
  impact: number | null;
  inherent_risk_value: number | null;
  inherent_risk_level: string | null;
  treatment: RiskTreatment | null;
  causes_count: number;
}

export interface RiskTreatment {
  decision: string;
  due_date: string;
  responsible: { id: string; type: string; person_name: string | null } | null;
}

export interface RiskCauseNode {
  id: string;
  code: string;
  name: string;
  failure_category: string;
  controls: ControlLink[];
}

export interface RiskDetail extends Omit<RiskListItem, 'causes_count'> {
  service_id: string;
  description: string;
  potential_impact: string[];
  causes: RiskCauseNode[];
}

export interface CauseRiskRef {
  id: string;
  code: string;
  name: string;
}

export interface Cause {
  id: string;
  service_id: string;
  code: string;
  name: string;
  description: string;
  failure_category: string;
  origin: RiskOrigin;
  is_active: boolean;
  risks: CauseRiskRef[];
  controls: ControlLink[];
}

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface LinkedControl {
  cause_id: string;
  control_id: string;
  is_mandatory: boolean;
  effect: string | null;
}

// Evaluación 5×5 y tratamiento de un riesgo (compliance-risks.md, MD-123). El valor y el nivel los calcula el servidor.
export const RISK_SCALE: readonly number[] = [1, 2, 3, 4, 5];
// enums.md `risk_treatment_decision`: el backend no lo sirve como catálogo, así que el formulario usa estos cuatro valores y el texto sale del i18n por valor.
export const TREATMENT_DECISIONS: readonly string[] = ['mitigate', 'accept', 'transfer', 'avoid'];

export interface RiskScore {
  likelihood: number;
  impact: number;
  inherent_risk_value: number;
  inherent_risk_level: string;
}

export interface RiskEvaluationEntry extends RiskScore {
  risk_id: string;
  previous: RiskScore | null;
  evaluated_by: { id: string; name: string | null; last_name: string | null } | null;
  evaluated_at: string;
}

// enums.md `responsible_type`: el backend no lo sirve como catálogo; el texto de cada valor sale del i18n.
export const RESPONSIBLE_TYPES: readonly string[] = ['coo', 'it', 'compliance', 'process', 'ciso', 'asset_owner'];

export interface Responsible {
  id: string;
  type: string;
  person_name: string | null;
  is_in_use: boolean;
}

export interface RiskTreatmentRecord {
  id: string;
  risk_id: string;
  decision: string;
  responsible: { id: string; type: string; person_name: string | null };
  due_date: string;
  created_at: string;
}

export interface NewTreatment {
  decision: string;
  responsible_id: string;
  due_date: string;
}
