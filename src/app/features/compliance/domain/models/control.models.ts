import { Readiness } from '@shared/domain/models/readiness.models';

// Acciones de protección = controles del cliente (contracts/modules/compliance-controls.md). En el cable se llaman `controls`.

export type TrustCriterion = 'security' | 'availability' | 'confidentiality' | 'integrity' | 'privacy';
export type ControlApproval = 'approved' | 'pending' | 'rejected';
export type ControlOrigin = 'catalog' | 'own';
export type ControlDimension = 'policy' | 'server' | 'database' | 'app' | 'cloud';

// Avance y cobertura viajan como conteos, nunca como porcentaje (philosophy.md).
export interface Progress {
  done: number;
  total: number;
}

export interface Coverage {
  measured: number;
  applicable: number;
}

export interface Assignee {
  user_id: string;
  name: string | null;
  last_name: string | null;
}

// Solo llega con `?view=technical` (auditor y consultor).
export interface ControlTechnical {
  control_code: string | null;
  requirement_codes: string[];
  points_of_focus: string[];
  control_state: string;
  tests_count: number;
  tests?: { test_code: string; display_name: string; dimension: ControlDimension; state: string }[];
}

export interface ControlListItem {
  id: string;
  own_code: string | null;
  name: string;
  origin: ControlOrigin;
  type: string;
  trust_criteria: TrustCriterion[];
  approval: ControlApproval;
  readiness: Readiness;
  progress: Progress;
  coverage: Coverage;
  assigned_to: Assignee | null;
  has_pending_change: boolean;
  technical?: ControlTechnical;
}

export interface ControlDimensionDetail {
  dimension: ControlDimension;
  applies: boolean;
  type: string | null;
  reason_not_applicable: string | null;
}

export interface ControlEvidence {
  requirement_id: string;
  description: string;
  responsible: { id: string; type: string; person_name: string | null } | null;
  latest_submission: { id: string; version: number; validation_status: 'pending' | 'approved' | 'rejected' } | null;
}

// «En qué falla»: por dimensión, el activo o la prueba afectados (de una prueba, solo su nombre neutro).
export interface ControlFailing {
  dimension: ControlDimension;
  affected: ({ kind: 'asset'; id: string; name: string } | { kind: 'test'; id: string; display_name: string })[];
}

export interface ControlDetail extends Omit<ControlListItem, 'technical'> {
  service_id: string;
  interpretation: { text: string; is_customized: boolean };
  dimensions: ControlDimensionDetail[];
  evidence: ControlEvidence[];
  causes: { id: string; name: string }[];
  failing: ControlFailing[];
  technical?: ControlTechnical;
}

// La página tal como la manda el backend (conventions.md).
export interface ControlsPageDto {
  items: ControlListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ControlFilters {
  page: number;
  pageSize: number;
  trustCriterion?: TrustCriterion | null;
  readiness?: Readiness | null;
}

// Cambios que se proponen (D65): hasta que el consultor aprueba, la acción sigue como estaba.
export type ControlChangeType = 'edit_interpretation' | 'edit_dimensions' | 'retire' | 'create';
export type ControlChangeStatus = 'pending' | 'approved' | 'rejected';

export interface ControlChange {
  id: string;
  control_id: string;
  change_type: ControlChangeType;
  status: ControlChangeStatus;
  requested_at: string;
  decision_note: string | null;
}

export type ProposeChangeBody =
  | { change_type: 'edit_interpretation'; proposed_values: { interpretation: string } }
  | { change_type: 'edit_dimensions'; proposed_values: { dimensions: { dimension: ControlDimension; applies: boolean; reason_not_applicable?: string }[] } }
  | { change_type: 'retire'; proposed_values: Record<string, never> };
