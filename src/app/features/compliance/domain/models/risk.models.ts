// Riesgos y causas de un servicio (contracts/modules/compliance-risks.md). Los valores de los enums (criterio, nivel, categoría de falla, tipo de
// pérdida) viajan como `string`: el backend no sirve sus catálogos, así que la pantalla no los enumera; los textos salen del i18n por valor.

export type RiskOrigin = 'catalog' | 'own';

// Un vínculo causa–control. `code` (D80) es el del catálogo (`IAC-12`) o el propio (`C01`); `own_code` es solo la numeración de los propios.
export interface ControlLink {
  control_id: string;
  code: string;
  own_code: string | null;
  name: string;
  is_mandatory: boolean;
  effect: string | null;
  technical?: { catalog_code: string | null };
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

/** Lo que se manda para crear o editar un riesgo propio (`POST /services/{id}/risks`, `PATCH /risks/{id}`). */
export interface RiskInput {
  name: string;
  description: string;
  trust_criterion: string;
  potential_impact: string[];
}

/** Lo que se manda para crear o editar una causa propia. */
export interface CauseInput {
  name: string;
  description: string;
  failure_category: string;
}

/** Una casilla de la matriz 5×5 con su valor (probabilidad × impacto) y el nivel que le da el servidor (`GET /risk-matrix`). */
export interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  value: number;
  level: string;
}

export interface RiskMatrixData {
  min: number;
  max: number;
  cells: RiskMatrixCell[];
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
// Las listas (escala de la matriz, decisiones de tratamiento, tipos de cargo…) las sirve el backend en `GET /v1/catalogs/{nombre}`: no se escriben aquí.
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
