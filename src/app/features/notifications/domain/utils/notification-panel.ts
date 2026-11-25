import { NotificationItem } from '../models/notification.models';

/** Hasta cuántos días atrás un aviso va en «Más recientes» del panel de la campana; lo anterior, en «Anteriores». */
export const RECENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface NotificationGroups {
  recent: NotificationItem[];
  older: NotificationItem[];
}

/** Reparte los avisos del panel entre «Más recientes» (los últimos `RECENT_DAYS` días) y «Anteriores», conservando el orden en que llegaron. */
export function groupByRecency(items: readonly NotificationItem[], now: number): NotificationGroups {
  const limit = now - RECENT_DAYS * DAY_MS;
  const groups: NotificationGroups = { recent: [], older: [] };
  for (const item of items) {
    const at = Date.parse(item.created_at);
    (Number.isNaN(at) || at >= limit ? groups.recent : groups.older).push(item);
  }
  return groups;
}

export interface TitleParts {
  /** El código del control con que empieza el título («IAC-12»), para destacarlo; `null` si el título no empieza por él. */
  code: string | null;
  text: string;
}

/** Separa el código del control del resto del título («IAC-12 · La ventana…» → «IAC-12» y «La ventana…»). El texto no se reescribe: solo se parte. */
export function titleParts(item: NotificationItem): TitleParts {
  const code = item.control?.code;
  if (!code || !item.title.startsWith(code)) return { code: null, text: item.title };
  const rest = item.title.slice(code.length).replace(/^\s*·\s*/, '').trim();
  return rest ? { code, text: rest } : { code, text: '' };
}
