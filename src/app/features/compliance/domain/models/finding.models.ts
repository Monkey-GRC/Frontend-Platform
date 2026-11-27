// Mensaje de brecha de una prueba automática (contracts/cumplimiento/brechas.md, D138, MD-502): una tarjeta por check y activo.
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type FindingKind = 'gap' | 'excepted' | 'observation';
/** Valor del catálogo `gap_priority`; la etiqueta la sirve el backend. */
export type GapPriority = 'critical' | 'high' | 'medium' | 'low';

export interface FindingResource {
  name: string | null;
  uid: string | null;
  region: string | null;
}

export interface FindingText {
  /** Puede traer marcas de formato simples (párrafos, viñetas, bloques de código): se muestra con `remediationBlocks`. */
  text: string;
  /** `es` si es la traducción de Monkey; `en` si se muestra el original por no tenerla. */
  language: 'es' | 'en';
  /** La traducción la hizo una IA y nadie la ha revisado: la pantalla lo dice. */
  is_ai_generated: boolean;
}
export type FindingRemediation = FindingText;

export interface FindingAsset {
  id: string;
  name: string;
  /** Valor del catálogo `asset_criticality`. */
  criticality: string;
}

export interface FindingPriorityBasis {
  /** Nulo cuando la sonda no califica sus checks. */
  severity: FindingSeverity | null;
  asset_criticality: string;
}

export interface FindingOwner {
  id: string;
  name: string;
  last_name: string;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  asset: FindingAsset;
  title: string;
  evaluated: FindingText | null;
  remediation: FindingRemediation | null;
  priority: GapPriority | null;
  priority_basis: FindingPriorityBasis | null;
  resources: FindingResource[];
  /** Cuántos recursos están afectados en total (`resources` trae hasta 50). */
  resources_total: number;
  exception: { id: string; effective_until: string } | null;
  owner: FindingOwner | null;
  /** Día del plan de remediación vigente (AAAA-MM-DD); nulo sin plan. */
  due_date: string | null;
  failing_since: string;
}

export interface FindingsSummary {
  open_gaps: number;
  excepted: number;
  observations: number;
}

export interface FindingsPage {
  control: { id: string; code: string; name: string };
  test: { id: string; code: string; display_name: string };
  measured_at: string | null;
  summary: FindingsSummary;
  items: Finding[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
