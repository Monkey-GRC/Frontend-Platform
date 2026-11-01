// Cómo se muestra a una persona en el círculo del perfil y en el menú. La cuenta se identifica por el correo (D51): el nombre es opcional.
export interface PersonLike {
  name?: string | null;
  last_name?: string | null;
  email: string;
}

const first = (text: string): string => Array.from(text.trim())[0]?.toUpperCase() ?? '';

/** Nombre y apellido si los hay; si no, el correo. */
export function displayNameOf(person: PersonLike): string {
  const full = [person.name, person.last_name].map((part) => part?.trim()).filter(Boolean).join(' ');
  return full || person.email;
}

/**
 * Las iniciales del círculo: nombre + apellido («Héctor Ríos» → HR). Con solo el nombre, la de cada una de sus dos primeras palabras. Sin nombre, las del correo
 * (`ana.perez@…` → AP; `soporte@…` → SO).
 */
export function initialsOf(person: PersonLike): string {
  const words = [person.name, person.last_name]
    .flatMap((part) => (part ?? '').trim().split(/\s+/))
    .filter(Boolean);
  if (words.length >= 2) return first(words[0]) + first(words[words.length === 2 ? 1 : words.length - 1]);
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  const local = person.email.split('@')[0] ?? '';
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) return first(parts[0]) + first(parts[1]);
  return Array.from(local).slice(0, 2).join('').toUpperCase() || '?';
}
