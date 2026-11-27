// La misma forma que valida el backend (el backend manda; esto solo ahorra un viaje): el ID de un tenant de Microsoft 365 y el de su aplicación son GUID.
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isM365Guid = (value: string): boolean => GUID.test(value.trim());

// Se pega tal cual de la salida del comando o del portal: sin espacios ni llaves. Si el texto no es un GUID, se devuelve limpio para que el formulario lo marque.
export const cleanM365Guid = (value: string): string => value.replace(/[\s{}]/g, '').toLowerCase().slice(0, 36);
