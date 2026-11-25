// Reglas del período auditado que se pueden avisar sin preguntarle al servidor (D145, `PUT …/evaluation-period`). Manda el servidor: esto solo evita hacer esperar a quien se equivoca.

const parse = (day: string): Date => new Date(`${day}T00:00:00Z`);
const format = (d: Date): string => d.toISOString().slice(0, 10);

/** El último día que ya cumple el mínimo: `inicio + meses − 1 día` (el 31 de agosto + 6 meses cae en el último día de febrero, no en marzo). Vacío si la fecha no es válida. */
export function earliestPeriodEnd(start: string, months: number): string {
  const s = parse(start);
  if (Number.isNaN(s.getTime())) return '';
  const target = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(s.getUTCDate(), lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return format(target);
}

export type PeriodProblem = 'range' | 'too_short' | null;

/** Lo que está mal con las fechas, si algo: el fin no es posterior al inicio, o el período es más corto que el mínimo del marco (`minMonths`, el que manda el servidor en `evaluation.min_period_months`, PR-16; `null` = sin mínimo). */
export function periodProblem(minMonths: number | null, start: string, end: string): PeriodProblem {
  if (!start || !end) return null;
  if (end <= start) return 'range';
  if (minMonths !== null && end < earliestPeriodEnd(start, minMonths)) return 'too_short';
  return null;
}
