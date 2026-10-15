// El porcentaje de avance de Cumplimiento (D80). La API manda conteos; la pantalla los convierte aquí.
//
// Reglas (contracts/conventions.md):
//  - Se TRUNCA a entero, nunca se redondea hacia arriba: 100 % es lo único que cumple, así que 99,6 % se muestra 99 %.
//  - Sin total (0) no hay porcentaje: devuelve null.
//  - Se calcula con enteros (`parte * 100 / total`) para que 29 de 100 sea 29 y no 28,999…
export function percentOf(part: number, total: number): number | null {
  if (!(total > 0)) return null;
  const value = Math.floor((Math.max(0, part) * 100) / total);
  return Math.min(100, value);
}

/** «60 %» en español y «60%» en inglés (según el idioma de la sesión); `null` se muestra como «—». */
export function formatPercent(value: number | null, language: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}
