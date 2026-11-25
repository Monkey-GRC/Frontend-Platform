const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatter(language: string): Intl.RelativeTimeFormat {
  let f = formatters.get(language);
  if (!f) {
    f = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'long' });
    formatters.set(language, f);
  }
  return f;
}

/**
 * «hace 5 minutos» / «5 minutes ago» desde un instante del backend hasta `now`. Menos de un minuto es «ahora» / «now». Devuelve `''` si el valor no se puede leer.
 * Es pura (recibe `now`) para probarla sin reloj.
 */
export function relativeTime(value: string | null | undefined, language: string, now: number): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const f = formatter(language);
  if (seconds < MINUTE) return f.format(0, 'second');
  if (seconds < HOUR) return f.format(-Math.floor(seconds / MINUTE), 'minute');
  if (seconds < DAY) return f.format(-Math.floor(seconds / HOUR), 'hour');
  return f.format(-Math.floor(seconds / DAY), 'day');
}
