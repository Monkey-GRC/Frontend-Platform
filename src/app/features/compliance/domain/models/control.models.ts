import { Readiness } from '@shared/domain/models/readiness.models';
import { EvidenceState } from './evidence.models';

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

// Solo llega con `?view=technical` (auditor y administrador de la empresa). El código del control y sus requisitos son de la vista de negocio (D80).
export interface ControlTechnical {
  points_of_focus: string[];
  control_state: string;
  tests_count: number;
  // `test_id` enlaza cada prueba documental con las evidencias que la respaldan en este control (`EvidenceRequirement.test`, D88).
  tests?: { test_id: string; test_code: string; display_name: string; display_description?: string | null; dimension: ControlDimension; state: string }[];
}

export interface ControlListItem {
  id: string;
  // D80: el código se muestra siempre (`IAC-12`, o `C01` en un control propio) y los requisitos que cubre (`CC6.1`; un control propio no cubre ninguno).
  code: string;
  requirement_codes: string[];
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
  latest_submission: { id: string; version: number; evidence_state: EvidenceState } | null;
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

// Editar un control es directo y al instante (D96): lo hace el administrador de la empresa, sin propuesta ni aprobación.
export type UpdateControlBody = {
  interpretation?: { text: string };
  dimensions?: { dimension: ControlDimension; applies: boolean; reason_not_applicable?: string }[];
};