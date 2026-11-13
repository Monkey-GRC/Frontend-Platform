// A dónde vuelve quien cierra un asistente a pantalla completa: la ruta de la que vino, pasada en `?returnTo=`. Solo se acepta una ruta interna (empieza por una sola «/»):
// nunca una dirección externa ni un esquema, para que un enlace manipulado no saque al cliente de la aplicación. Si no sirve, se usa la de reserva.
export function safeReturnUrl(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || hasControlChars(raw)) return fallback;
  return raw;
}

function hasControlChars(value: string): boolean {
  return Array.from(value).some((c) => c.charCodeAt(0) < 32);
}
