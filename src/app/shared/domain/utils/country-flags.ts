// Banderas redondas de `public/images/flags/` (circle-flags, MIT), por el código del catálogo de países. Las usan el onboarding y los servicios.
// LATAM y Global no tienen bandera y llevan un icono. («Otro» lo resuelve cada pantalla: en otros catálogos «other» no es un país.)
export const FLAG_FILES = new Set(['co', 'mx', 'pe', 'cl', 'ar', 'br', 'ec', 'uy', 'py', 'bo', 've', 'cr', 'pa', 'gt', 'us', 'ca', 'es', 'pt', 'gb', 'de', 'fr', 'eu']);
export const SYMBOLS: Record<string, string> = { latam: 'travel_explore', global: 'public' };
