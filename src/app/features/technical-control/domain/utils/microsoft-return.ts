/** Con qué vuelve el navegador de Microsoft (lo arma el backend): el recibo para terminar, o el motivo por el que no se pudo, y la conexión. */
export const MICROSOFT_HANDLE_PARAM = 'm365';
export const MICROSOFT_ERROR_PARAM = 'm365_error';
export const MICROSOFT_ASSET_PARAM = 'asset';

const KNOWN_ERRORS: readonly string[] = ['cancelled', 'expired', 'not_admin', 'personal_account', 'identity_rejected', 'unavailable'];

/** La clave del mensaje de un motivo; uno desconocido se cuenta como una autorización que no se completó. `null` si no hubo motivo. */
export function microsoftReturnErrorKey(code: string | null): string | null {
  if (!code) return null;
  return `TECHNICAL_CONTROL.WIZARD.M365.RETURN.${(KNOWN_ERRORS.includes(code) ? code : 'cancelled').toUpperCase()}`;
}
