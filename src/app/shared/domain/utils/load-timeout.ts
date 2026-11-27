/**
 * Una carga que no responde en este tiempo se da por fallida: la pantalla muestra el error con «Reintentar» en vez de
 * quedarse en «cargando». El techo del backend es 6–7 s por petición (MD-530); esto deja margen para la red sin dejar
 * al usuario esperando indefinidamente.
 */
export const LOAD_TIMEOUT_MS = 15_000;
