import { TranslateService } from '@ngx-translate/core';

// El nombre de cada tipo de conexión (ac_01…ac_06) sale de la base de datos y solo está en español. El cliente lo ve en su idioma:
// se busca la clave `TECHNICAL_CONTROL.CATEGORY.<CÓDIGO>` y, si un tipo nuevo aún no la tiene, se muestra el texto del backend.
export function categoryLabel(translate: TranslateService, code: string, fallback: string): string {
  const key = `TECHNICAL_CONTROL.CATEGORY.${code.toUpperCase()}`;
  const text = translate.instant(key);
  return text === key ? fallback : text;
}