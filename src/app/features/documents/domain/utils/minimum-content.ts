/**
 * El «contenido mínimo» de un documento viene del catálogo como un texto; si trae una enumeración («1- … 2- …», «1. … 2. …», «1) …», en líneas o corrida) se presenta como lista
 * ordenada, sin cambiar el dato. Solo se parte si los números son consecutivos desde 1 (1, 2, 3…); si el texto no es una enumeración de dos o más puntos, o un número suelto lo rompe («Ver artículo 5»), devuelve `null` y la pantalla lo muestra tal cual.
 */
export function numberedItems(text: string | null | undefined): string[] | null {
  const value = (text ?? '').trim();
  if (!/^\d{1,2}\s*[-.)]\s*\S/.test(value)) return null;
  const chunks = value.split(/(?:^|\s)(?=\d{1,2}\s*[-.)]\s*\S)/).filter((p) => p.trim().length > 0);
  const numbers = chunks.map((p) => Number(/^\d{1,2}/.exec(p.trim())?.[0]));
  if (chunks.length < 2 || !numbers.every((n, i) => n === i + 1)) return null;
  const parts = chunks.map((p) => p.replace(/^\s*\d{1,2}\s*[-.)]\s*/, '').trim());
  return parts.every((p) => p.length > 0) ? parts : null;
}
