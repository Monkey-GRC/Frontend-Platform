import { ParamMap, Params } from '@angular/router';
import { ASSIGNMENT_FILTER_PARAM, COMPLIANCE_SERVICE_PARAM } from '@shared/domain/models/route-links';
import { ASSIGNMENT_FILTERS, AssignmentFilter, CONTROL_STATES, ControlState } from '../models/assignment.models';

/** Los parámetros de la dirección de Asignación: el servicio es el mismo `servicio` de Cumplimiento; el resto, los filtros de la pantalla. */
export const ASSIGNMENT_PARAMS = {
  service: COMPLIANCE_SERVICE_PARAM,
  assignment: ASSIGNMENT_FILTER_PARAM,
  owner: 'dueno',
  executor: 'delegado',
  status: 'estado',
  search: 'q',
} as const;

/** Lo que la dirección dice de la pantalla: el servicio y los filtros. */
export interface AssignmentQueryState {
  serviceId: string | null;
  assignment: AssignmentFilter | null;
  ownerId: string | null;
  executorId: string | null;
  status: ControlState | null;
  q: string;
}

export const EMPTY_QUERY: AssignmentQueryState = { serviceId: null, assignment: null, ownerId: null, executorId: null, status: null, q: '' };

const oneOf = <T extends string>(list: readonly T[], value: string | null): T | null => (value !== null && (list as readonly string[]).includes(value) ? (value as T) : null);

/** Lee la dirección: un valor que no es de la lista (un enlace viejo o escrito a mano) se ignora en vez de romper la pantalla. */
export function parseAssignmentQuery(query: ParamMap): AssignmentQueryState {
  return {
    serviceId: query.get(ASSIGNMENT_PARAMS.service) || null,
    assignment: oneOf(ASSIGNMENT_FILTERS, query.get(ASSIGNMENT_PARAMS.assignment)),
    ownerId: query.get(ASSIGNMENT_PARAMS.owner) || null,
    executorId: query.get(ASSIGNMENT_PARAMS.executor) || null,
    status: oneOf(CONTROL_STATES, query.get(ASSIGNMENT_PARAMS.status)),
    q: query.get(ASSIGNMENT_PARAMS.search)?.trim() ?? '',
  };
}

/** Los parámetros de la dirección para un estado de la pantalla; lo vacío va como `null` para que `merge` lo quite. */
export function assignmentQueryParams(view: AssignmentQueryState): Params {
  return {
    [ASSIGNMENT_PARAMS.service]: view.serviceId,
    [ASSIGNMENT_PARAMS.assignment]: view.assignment,
    [ASSIGNMENT_PARAMS.owner]: view.ownerId,
    [ASSIGNMENT_PARAMS.executor]: view.executorId,
    [ASSIGNMENT_PARAMS.status]: view.status,
    [ASSIGNMENT_PARAMS.search]: view.q.trim() || null,
  };
}

export function hasActiveFilters(view: AssignmentQueryState): boolean {
  return view.assignment !== null || view.ownerId !== null || view.executorId !== null || view.status !== null || view.q.trim() !== '';
}
