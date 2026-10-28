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

// Solo llega con `?view=technical` (auditor y consultor). Hoy el backend aún trae aquí `control_code` y `requirement_codes`; por D80 pasan
// a la vista de negocio (`code` y `requirement_codes` del control), y esto queda como respaldo hasta que se mueva.
export interface ControlTechnical {
  control_code?: string | null;
  requirement_codes?: string[];
  points_of_focus: string[];
  control_state: string;
  tests_count: number;
  // `test_id` enlaza cada prueba documental con las evidencias que la respaldan en este control (`EvidenceRequirement.test`, D88).
  tests?: { test_id: string; test_code: string; display_name: string; display_description?: string | null; dimension: ControlDimension; state: string }[];
}

export interface ControlListItem {
  id: string;
  // D80: el código se muestra siempre (`IAC-12`, o `C01` en un control propio) y los requisitos que cubre (`CC6.1`). Opcionales mientras el
  // backend no los mueva a la vista de negocio (contracts/modules/compliance-controls.md → «Estado de implementación»).
  code?: string | null;
  requirement_codes?: string[];
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

/** El código que identifica al control: el de la vista de negocio, o el técnico si el backend aún lo manda ahí, o el propio (`C01`). */
export function controlCode(c: Pick<ControlListItem, 'code' | 'own_code' | 'technical'>): string | null {
  return c.code ?? c.technical?.control_code ?? c.own_code ?? null;
}

/** Los requisitos del marco que cubre el control (`CC6.1`). */
export function requirementCodes(c: Pick<ControlListItem, 'requirement_codes' | 'technical'>): string[] {
  return c.requirement_codes ?? c.technical?.requirement_codes ?? [];
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

// Quién es responsable de cada dimensión de un control (users-team.md): la excepción de este control o, si no la hay, el responsable del servicio.
export interface ControlResponsible {
  dimension: ControlDimension;
  tests_count: number;
  owner: { id: string; email: string; name: string | null; last_name: string | null } | null;
  source: 'control' | 'service' | null;
}

/** Una persona del equipo a la que se le puede dar un control: un `funcional` con sus especialidades. */
export interface ResponsibleCandidate {
  id: string;
  email: string;
  name: string | null;
  last_name: string | null;
  status: string;
  dimensions: ControlDimension[];
}