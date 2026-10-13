import { HttpErrorResponse } from '@angular/common/http';

/**
 * mnk-client-identifier/mnk-client-key son un detalle interno de enrutamiento
 * entre tenants (ver ClientCredentialsGuard en el backend) — nunca deben
 * llegar a un humano, sea el cliente o un admin. Si el backend responde con
 * uno de esos mensajes (bug, estado inconsistente), se reemplaza aquí, en el
 * único punto por el que pasan todas las respuestas, antes de que cualquier
 * componente futuro pueda mostrarlo sin filtrar.
 */
const INTERNAL_ROUTING_MESSAGE_PATTERN = /mnk-client-(identifier|key)|credenciales de tenant/i;

// `replacement` es el texto que ve el cliente en lugar del mensaje interno (ya traducido por quien llama).
export function sanitizeHttpError(error: HttpErrorResponse, replacement: string): HttpErrorResponse {
  const message = error.error?.message;
  if (typeof message !== 'string' || !INTERNAL_ROUTING_MESSAGE_PATTERN.test(message)) {
    return error;
  }

  return new HttpErrorResponse({
    error: { ...error.error, message: replacement },
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
}
