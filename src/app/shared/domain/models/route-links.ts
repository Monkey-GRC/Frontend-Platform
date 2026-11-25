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

export interface RouteLink {
  commands: string[];
  queryParams: Record<string, string>;
}

/** Un control se abre en Cumplimiento → Controles con `?abrir=<id>`; con su servicio, Cumplimiento lo deja como servicio activo. */
export function controlLink(controlId: string, serviceId?: string | null): RouteLink {
  const queryParams: Record<string, string> = { [OPEN_PARAM]: controlId };
  if (serviceId) queryParams[COMPLIANCE_SERVICE_PARAM] = serviceId;
  return { commands: [`/${COMPLIANCE_ROUTE}`, COMPLIANCE_CONTROLS_SECTION], queryParams };
}

/** Los controles sin dueño de un servicio, en Asignación. */
export function unassignedControlsLink(serviceId: string): RouteLink {
  return { commands: [`/${ASSIGNMENT_ROUTE}`], queryParams: { [COMPLIANCE_SERVICE_PARAM]: serviceId, [ASSIGNMENT_FILTER_PARAM]: ASSIGNMENT_UNASSIGNED } };
}
