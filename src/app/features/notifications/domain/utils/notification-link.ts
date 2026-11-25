import { RouteLink, controlLink, unassignedControlsLink } from '@shared/domain/models/route-links';
import { NotificationItem } from '../models/notification.models';

export type NotificationLink = RouteLink;

// Dónde se resuelve una notificación (el contrato dice que la pantalla arma el enlace). Un control se abre en Cumplimiento → Controles con `?abrir=<id>` y, si la notificación trae su servicio,
// `?servicio=<id>` (Cumplimiento lo deja como servicio activo); la agrupada de un servicio (controles «Sin asignar», `target.kind = service`) lleva a Asignación, con ese servicio y el filtro «Sin asignar»,
// que es donde se corrige. Los demás tipos de destino están reservados (las de documento llegan con MD-506): sin enlace, la notificación se lee en su detalle.
// La ruta y los parámetros salen de `shared/` (los mismos que usan Cumplimiento y Asignación): una feature no importa el interior de otra.
export function notificationLink(notification: NotificationItem): NotificationLink | null {
  const { target } = notification;
  if (target.kind === 'service' && target.id) return unassignedControlsLink(target.id);
  if (target.kind !== 'control' || !target.id) return null;
  return controlLink(target.id, target.service_id);
}

/** El enlace de cada control de la notificación agrupada (`controls`): abre ese control en Cumplimiento, en el servicio de la notificación. */
export function groupedControlLinks(notification: NotificationItem): { id: string; code: string; link: NotificationLink }[] {
  const serviceId = notification.service?.id ?? notification.target.service_id ?? notification.target.id;
  return (notification.controls ?? []).map((c) => ({ ...c, link: controlLink(c.id, serviceId) }));
}
