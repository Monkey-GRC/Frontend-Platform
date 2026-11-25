// Las notificaciones de la campana (contracts/notificaciones.md, D138, D143, D151). Los nombres de campo son los del contrato (snake_case).

/** Un valor de `notification_type`. Las opciones y sus etiquetas las sirve `GET /v1/catalogs/notification_type`: el frontend no escribe la lista. */
export type NotificationType = string;

/** `notification_target_kind`: a qué apunta el aviso. La pantalla arma el enlace; la API no conoce rutas. `service` es el aviso agrupado de controles «Sin asignar» de un servicio. */
export type NotificationTargetKind = 'control' | 'service' | 'document' | 'company';

/** `notification_read_filter`: el parámetro `status` de la lista. */
export type NotificationReadFilter = 'all' | 'unread' | 'read';
export const NOTIFICATION_READ_FILTERS: readonly NotificationReadFilter[] = ['all', 'unread', 'read'];

/** La plantilla de 7 campos, ya traducida; cada campo puede venir `null` y la pantalla lo omite. */
export interface NotificationDetail {
  what_happened: string | null;
  why_it_matters: string | null;
  how_to_fix: string | null;
  who: string | null;
  time_needed: string | null;
  evidence: string | null;
  impact: string | null;
}

export type NotificationDetailField = keyof NotificationDetail;

/** El orden en que se leen los 7 campos (monkey-ui-copy §1). */
export const NOTIFICATION_DETAIL_FIELDS: readonly NotificationDetailField[] = [
  'what_happened',
  'why_it_matters',
  'how_to_fix',
  'who',
  'time_needed',
  'evidence',
  'impact',
];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  due_at: string | null;
  title: string;
  detail: NotificationDetail;
  service: { id: string; name: string } | null;
  control: { id: string; code: string; name: string; requirement_codes: string[] } | null;
  /** Solo en el aviso agrupado de controles «Sin asignar» (`target.kind = service`): hasta 5 controles para enlazarlos; `[]` en los demás. El total va en el título. `id` es el `client_control_id`. */
  controls: { id: string; code: string }[];
  target: { kind: NotificationTargetKind; id: string; service_id: string | null };
}

export interface NotificationPageDto {
  items: NotificationItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface NotificationFilters {
  status?: NotificationReadFilter;
  type?: NotificationType | null;
  page?: number;
  pageSize?: number;
}

export interface NotificationPreferences {
  is_email_digest_enabled: boolean;
  /** La hora (UTC, «HH:MM») desde la que sale el resumen. */
  email_digest_time_utc: string;
}

/** Los eventos del canal en vivo (`GET /v1/me/notifications/stream`). */
export interface StreamReady {
  unread_count: number;
}
export interface StreamNotification {
  unread_count: number;
  notification: NotificationItem;
}
