const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id recibido por la URL solo se usa si tiene forma de uuid. */
export const isUuid = (value: string | null | undefined): value is string => !!value && UUID.test(value);
