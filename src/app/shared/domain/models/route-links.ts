// Rutas y parámetros de enlace que usan varias features. Viven en `shared/` porque una feature no importa el interior de otra: Cumplimiento los define y
// otras (Avisos) arman enlaces hacia él con los mismos valores.

/** Cumplimiento es un grupo del menú: cada sección es una página en `/cumplimiento/<sección>`. */
export const COMPLIANCE_ROUTE = 'cumplimiento';
/** La sección de Controles de Cumplimiento. */
export const COMPLIANCE_CONTROLS_SECTION = 'controles';
/** Un enlace que lleva a un servicio concreto lo manda en `?servicio=<id>` (Cumplimiento lo deja como servicio activo). */
export const COMPLIANCE_SERVICE_PARAM = 'servicio';
/** Una lista abre el detalle de un elemento con `?abrir=<id>`. */
export const OPEN_PARAM = 'abrir';

/** La pantalla de Asignación (dueño y ejecutor de cada control) y su filtro de asignación en la dirección: `?servicio=<id>&asignacion=unassigned`. */
export const ASSIGNMENT_ROUTE = 'asignacion';
export const ASSIGNMENT_FILTER_PARAM = 'asignacion';
/** El valor del filtro `assignment` que deja solo los controles sin dueño (el mismo del backend). */
export const ASSIGNMENT_UNASSIGNED = 'unassigned';

/** Equipo → Personas; abre el detalle de una persona con `?abrir=<id>` (lo usa el historial de un control). */
export const TEAM_PEOPLE_COMMANDS = ['/equipo', 'personas'];

export interface RouteLink {
  commands: string[];
  queryParams: Record<string, string>;
}

/** Un control se abre en Cumplimiento → Controles con `?abrir=<id>` (y `&tab=` para una pestaña, p. ej. `approval`); con su servicio, Cumplimiento lo deja como servicio activo. */
export function controlLink(controlId: string, serviceId?: string | null, tab?: string): RouteLink {
  const queryParams: Record<string, string> = { [OPEN_PARAM]: controlId };
  if (tab) queryParams['tab'] = tab;
  if (serviceId) queryParams[COMPLIANCE_SERVICE_PARAM] = serviceId;
  return { commands: [`/${COMPLIANCE_ROUTE}`, COMPLIANCE_CONTROLS_SECTION], queryParams };
}

/** El detalle de una persona del equipo, en Equipo → Personas. */
export function personLink(userId: string): RouteLink {
  return { commands: [...TEAM_PEOPLE_COMMANDS], queryParams: { [OPEN_PARAM]: userId } };
}

/** Los controles sin dueño de un servicio, en Asignación. */
export function unassignedControlsLink(serviceId: string): RouteLink {
  return { commands: [`/${ASSIGNMENT_ROUTE}`], queryParams: { [COMPLIANCE_SERVICE_PARAM]: serviceId, [ASSIGNMENT_FILTER_PARAM]: ASSIGNMENT_UNASSIGNED } };
}
