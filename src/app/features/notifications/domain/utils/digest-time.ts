/**
 * La hora del resumen («12:00», en UTC) en la zona horaria de quien lo lee, para el día de `now` (el horario de verano la mueve). `''` si el texto no es una hora.
 * Pura: recibe `now` y el idioma, y usa la zona del navegador.
 */
export function digestLocalTime(hhmm: string | null | undefined, language: string, now: Date): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  const instant = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes));
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(instant);
}
