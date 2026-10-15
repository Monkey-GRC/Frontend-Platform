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
  // Llega con MD-123; hoy siempre `null`.
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
