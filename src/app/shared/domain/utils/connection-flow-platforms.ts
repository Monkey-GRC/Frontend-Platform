// Las plataformas que tienen un recorrido en el asistente de conexión (`features/technical-control/.../connection-flows.ts`), por su código. Vive en shared porque la pantalla de
// «Nueva conexión» (integraciones) necesita saber cuáles se pueden abrir sin importar el interior de otra feature. Añadir una plataforma es tocar AQUÍ y en `CONNECTION_FLOWS`:
// una prueba de `connection-flows.spec.ts` falla si las dos listas no coinciden.
export const CONNECTION_FLOW_PLATFORMS: readonly string[] = ['aws', 'gcp', 'microsoft_365', 'linux', 'windows'];

export const hasConnectionFlow = (platform: string): boolean => CONNECTION_FLOW_PLATFORMS.includes(platform);
