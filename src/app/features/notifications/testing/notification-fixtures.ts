import { NotificationItem } from '@features/notifications/domain/models/notification.models';

/** Un aviso del contrato (`window_due_soon` de un control), con lo que cada prueba quiera cambiar. */
export function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n-1',
    type: 'window_due_soon',
    is_read: false,
    read_at: null,
    created_at: '2026-12-16T12:00:05Z',
    due_at: '2026-12-31',
    title: 'IAC-12 · La ventana trimestral cierra el 31/12/2026 y falta evidencia',
    detail: {
      what_happened: 'La prueba del control IAC-12 (CC6.1, CC6.2) no tiene evidencia válida.',
      why_it_matters: 'Si la ventana cierra sin evidencia, el requisito pasa a Vencido.',
      how_to_fix: 'Sube la evidencia desde el detalle del control y pide su revisión.',
      who: 'Ejecuta: Juan Pérez · Dueño: Laura Gómez',
      time_needed: 'Quedan 15 días para el cierre.',
      evidence: 'La que pide la prueba del trimestre en curso.',
      impact: 'Con la evidencia a tiempo, el control conserva su nivel.',
    },
    service: { id: 'svc-1', name: 'Plataforma de pagos' },
    control: { id: 'ctl-1', code: 'IAC-12', name: 'Revisión de accesos privilegiados', requirement_codes: ['CC6.1', 'CC6.2'] },
    controls: [],
    target: { kind: 'control', id: 'ctl-1', service_id: 'svc-1' },
    ...overrides,
  };
}

/** El sobre `{ statusCode, message, data }` de la API. */
export function envelope<T>(data: T, message = 'ok'): { statusCode: number; message: string; data: T } {
  return { statusCode: 200, message, data };
}

export function pageOf(items: NotificationItem[], page = 1, totalPages = 1, total = items.length) {
  return envelope({ items, page, page_size: 25, total, total_pages: totalPages }, 'notification.list');
}
