import { NotificationItem } from '../models/notification.models';

/** El color de la insignia de la tarjeta: lleva el estado que dice el tipo de aviso (`info` es el azul de marca). */
export type NoticeTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'info';

export interface NoticeAppearance {
  /** Nombre del ícono (Material Symbols Rounded). */
  icon: string;
  tone: NoticeTone;
}

// Cada tipo del catálogo (`notification_type`, contracts/enums/notificaciones.md) con su ícono y su tono: alerta para ventanas y fallas, información para asignación y revisión, ok y mala
// noticia para la evidencia validada o rechazada. Un tipo que aún no está aquí (el catálogo crece en el backend) cae en «información», no se rompe.
const APPEARANCE: Readonly<Record<string, NoticeAppearance>> = {
  window_due_soon: { icon: 'schedule', tone: 'warn' },
  window_expired: { icon: 'event_busy', tone: 'bad' },
  direct_check_failed: { icon: 'error', tone: 'bad' },
  automatic_evidence_stale: { icon: 'update', tone: 'warn' },
  check_parameters_changed: { icon: 'tune', tone: 'info' },
  control_assigned: { icon: 'assignment_ind', tone: 'info' },
  evidence_approved: { icon: 'task_alt', tone: 'ok' },
  evidence_rejected: { icon: 'cancel', tone: 'bad' },
  observation_created: { icon: 'rate_review', tone: 'info' },
  control_pending_approval: { icon: 'pending_actions', tone: 'warn' },
  control_owner_approved: { icon: 'verified', tone: 'ok' },
  control_returned: { icon: 'undo', tone: 'warn' },
  document_assigned: { icon: 'description', tone: 'info' },
  document_acceptance_reminder: { icon: 'draw', tone: 'warn' },
  document_approval_requested: { icon: 'rule', tone: 'warn' },
  document_renewal_due: { icon: 'autorenew', tone: 'warn' },
  company_purge_upcoming: { icon: 'delete_forever', tone: 'bad' },
};

const FALLBACK: NoticeAppearance = { icon: 'info', tone: 'info' };

export function noticeAppearance(type: string): NoticeAppearance {
  return APPEARANCE[type] ?? FALLBACK;
}

/** Cuántos códigos caben en el pie de una tarjeta antes de resumir el resto en «+N» (el detalle los lleva todos). */
export const MAX_CARD_CODES = 4;

export interface CardCodes {
  codes: string[];
  /** Los que no caben; sus códigos van en `hidden`. */
  more: number;
  hidden: string[];
}

/** Los códigos del pie de la tarjeta: el del control y sus requisitos, o los controles agrupados del aviso «Sin asignar». Sin repetidos y en el orden en que llegan. */
export function cardCodes(item: NotificationItem, max = MAX_CARD_CODES): CardCodes {
  const raw = item.control ? [item.control.code, ...item.control.requirement_codes] : (item.controls ?? []).map((c) => c.code);
  const all = [...new Set(raw.filter((c) => !!c))];
  return { codes: all.slice(0, max), more: Math.max(0, all.length - max), hidden: all.slice(max) };
}
