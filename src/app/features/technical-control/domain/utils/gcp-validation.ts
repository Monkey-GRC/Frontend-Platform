// Las mismas formas que valida el backend (el backend manda; esto solo ahorra un viaje): el ID de un proyecto de Google Cloud y su número.
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const PROJECT_NUMBER = /^\d{6,19}$/;

export const isGcpProjectId = (value: string): boolean => PROJECT_ID.test(value.trim());
export const isGcpProjectNumber = (value: string): boolean => PROJECT_NUMBER.test(value.trim());

// El número de proyecto solo lleva dígitos: se pega tal cual de la salida del comando, sin espacios.
export const cleanGcpProjectNumber = (value: string): string => value.replace(/\D/g, '').slice(0, 19);
