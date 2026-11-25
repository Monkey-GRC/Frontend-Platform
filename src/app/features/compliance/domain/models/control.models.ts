import { UserRole } from '@core/domain/models/auth.models';
import { Readiness } from '@shared/domain/models/readiness.models';
import { EvidenceState } from './evidence.models';

// Acciones de protección = controles del cliente (contracts/modules/compliance-controls.md). En el cable se llaman `controls`.

export type TrustCriterion = 'security' | 'availability' | 'confidentiality' | 'integrity' | 'privacy';
export type ControlApproval = 'approved' | 'pending' | 'rejected';
export type ControlOrigin = 'catalog' | 'own';
// Las 9 dimensiones (enums `dimension`). El orden y las etiquetas salen del catálogo `/catalogs/dimension`, no de una lista escrita aquí.
export type ControlDimension = 'policy' | 'server' | 'database' | 'app' | 'cloud' | 'network' | 'endpoint' | 'physical' | 'process';

// Avance y cobertura viajan como conteos, nunca como porcentaje (philosophy.md).
export interface Progress {
  done: number;
  total: number;
}

export interface Coverage {
  measured: number;
  applicable: number;
}

// Dueño o ejecutor de un control (D102).
export interface ControlPerson {
  id: string;
  name: string | null;
  last_name: string | null;
  role: UserRole;
}

// Motor v2 (MD-498/499/500). Los valores son los de contracts/enums: el texto sale del i18n, nunca de listas escritas aquí.
export type ControlLevel = 'not_evaluated' | 'ineffective' | 'weak' | 'partial' | 'adequate' | 'solid';
export type RequirementStatus = 'compliant' | 'non_compliant' | 'pending' | 'expired' | 'not_applicable';
export type TestStatus = 'pending' | 'correct' | 'observation' | 'exception' | 'not_applicable' | 'expired';
export type CheckRole = 'direct' | 'complementary' | 'dependency';
export type Periodicity = 'permanent' | 'daily' | 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'on_demand';
export type PeriodicitySource = 'catalog' | 'client';

// Un vínculo ratificado de la prueba con su rol. Nunca trae el proveedor ni el identificador interno del check (regla 1).
export interface CheckLink {
  role: CheckRole;
  kind: 'check' | 'module';
  check: { id: string; title: string } | null;
  module: 'vulnerabilities' | 'score' | 'other' | null;
  // Solo en un Complementario: los activos en alcance cuyo resultado más reciente es FAIL (lo que da la Observación). `null` en Directos y Dependencias.
  failing_assets: number | null;
  // Solo en una Dependencia: el control dueño y el estado de su prueba; `control_id: null` si no está en el alcance del servicio.
  owner: { control_id: string | null; control_code: string; test_status: TestStatus | null } | null;
}

export interface RequirementTest {
  test_id: string;
  test_code: string;
  display_name: string;
  status: TestStatus;
  // MD-499 · Si la prueba se cumple subiendo evidencia, y si es solo mientras no hay integración conectada.
  accepts_evidence: boolean;
  evidence_fallback: boolean;
  window_end: string | null;
  alert_at: string | null;
  checks: { direct_pass: number; direct_fail: number; direct_exception: number; no_data: number; complementary_fail: number } | null;
  asset_coverage: { with_result: number; in_scope: number } | null;
  check_links: CheckLink[];
}

export interface ControlRequirement {
  id: string;
  code: string;
  text: string;
  type: string;
  periodicity: Periodicity;
  suggested_periodicity?: Periodicity;
  periodicity_source?: PeriodicitySource;
  status: RequirementStatus;
  tests: RequirementTest[];
}

export interface PeriodicityChange {
  periodicity: Periodicity;
  justification: string;
  changed_at: string;
}

// La vista del período auditado abierto: solo cuentan las ventanas ya cerradas dentro de él.
export interface ControlPeriod {
  level: ControlLevel;
  complies: boolean;
  windows: { total: number; with_evidence: number };
  missing: { requirement_code: string; window_start: string; window_end: string }[];
}

// Solo llega con `?view=technical` (auditor y administrador de la empresa). El código del control y sus requisitos son de la vista de negocio (D80).
export interface ControlTechnical {
  points_of_focus: string[];
  // Motor v2: el nivel 0–5 (R1 a R6) y el C%; los requisitos solo en el detalle.
  level?: ControlLevel;
  level_value?: number;
  complies?: boolean;
  c_percent?: number | null;
  requirements?: ControlRequirement[];
  periodicity_change?: PeriodicityChange | null;
  period?: ControlPeriod | null;
  // `test_id` enlaza cada prueba documental con las evidencias que la respaldan en este control (`EvidenceRequirement.test`, D88).
  tests?: { test_id: string; test_code: string; display_name: string; display_description?: string | null; dimension: ControlDimension; status: TestStatus; accepts_evidence: boolean; evidence_fallback: boolean }[];
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
  owner: ControlPerson | null;
  executor: ControlPerson | null;
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

// MD-499 · Una prueba del control que acepta evidencia, para todos los roles (sin checks, niveles ni requisitos).
export interface EvidenceTest {
  test_id: string;
  test_code: string;
  display_name: string;
  dimension: ControlDimension;
  status: TestStatus;
  evidence_fallback: boolean;
  requirement_id: string | null;
}

export interface ControlDetail extends Omit<ControlListItem, 'technical'> {
  service_id: string;
  interpretation: { text: string; is_customized: boolean };
  dimensions: ControlDimensionDetail[];
  evidence: ControlEvidence[];
  causes: { id: string; code: string; name: string | null }[];
  failing: ControlFailing[];
  technical?: ControlTechnical;
  evidence_tests?: EvidenceTest[];
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
export interface UpdateControlBody {
  interpretation?: { text: string };
  dimensions?: { dimension: ControlDimension; applies: boolean; reason_not_applicable?: string }[];
}

// Cambiar la periodicidad de un control del catálogo (G-10, D147): `null` vuelve a la sugerida. La justificación es obligatoria (1 a 1000 caracteres).
export interface UpdatePeriodicityBody {
  periodicity: Periodicity | null;
  justification: string;
}
