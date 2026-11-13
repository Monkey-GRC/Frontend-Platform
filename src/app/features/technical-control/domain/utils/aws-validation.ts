// Lo que se puede comprobar de una cuenta de AWS sin preguntar al servidor: el número son 12 dígitos. El resto (rol, regiones) lo valida el backend.
const ACCOUNT_ID = /^\d{12}$/;

export const isAwsAccountId = (value: string): boolean => ACCOUNT_ID.test(value.trim());

// Se pega tal cual de la consola de AWS: solo dígitos, sin guiones ni espacios.
export const cleanAwsAccountId = (value: string): string => value.replace(/\D/g, '').slice(0, 12);
