// Asignación de controles (contracts/gestion-usuarios.md → «Asignación de controles», D150, MD-192, MD-503). Los nombres de campo son los del contrato (snake_case).
import type { UserRole } from '@core/domain/models/auth.models';

/** El filtro `assignment`: `unassigned` es un control sin dueño. */
export type AssignmentFilter = 'unassigned' | 'assigned';
export const ASSIGNMENT_FILTERS: readonly AssignmentFilter[] = ['unassigned', 'assigned'];

/** El estado derivado del control que entrega `GET /v1/assignments` (`control_state`); el backend no lo sirve como catálogo, así que su texto sale de i18n por valor. */
export type ControlState = 'effective' | 'ineffective' | 'expired' | 'error' | 'incomplete' | 'evaluating' | 'no_tests';
export const CONTROL_STATES: readonly ControlState[] = ['effective', 'ineffective', 'expired', 'error', 'incomplete', 'evaluating', 'no_tests'];

export interface AssignedPerson {
  id: string;
  name: string | null;
  last_name: string | null;
  role: UserRole;
}

export interface AssignmentItem {
  client_control_id: string;
  code: string;
  requirement_codes: string[];
  name: string;
  service: { id: string; name: string };
  categories: string[];
  assignment: AssignmentFilter;
  owner: AssignedPerson | null;
  /** Nulo = ejecuta el dueño. */
  executor: AssignedPerson | null;
  state: ControlState;
}

export interface AssignmentPageDto {
  items: AssignmentItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** Los filtros de `GET /v1/assignments`; los vacíos no se mandan. */
export interface AssignmentFilters {
  serviceId?: string | null;
  assignment?: AssignmentFilter | null;
  ownerId?: string | null;
  executorId?: string | null;
  status?: ControlState | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}

/** La respuesta de `PUT /v1/assignments/owner` y `/executor`: cuántos controles cambiaron de verdad. */
export interface AssignmentResult {
  updated: number;
}

/** Hasta cuántos controles admite una asignación masiva. */
export const MAX_BATCH = 200;
