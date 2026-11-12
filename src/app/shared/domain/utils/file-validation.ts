import { storedLanguage } from '@core/domain/services/language.service';

// Validación de un archivo antes de subirlo: tipo (por extensión) y tamaño. Es pura y no conoce textos: devuelve la clave de
// traducción del problema y sus variables, y quien la muestra la pasa por `translate`.
export interface FileRules {
  // Extensiones permitidas, con punto y en minúsculas: ['.pdf', '.docx'].
  accept: readonly string[];
  maxBytes: number;
}

export interface FileProblem {
  key: 'COMMON.FILE.ERROR_TYPE' | 'COMMON.FILE.ERROR_SIZE' | 'COMMON.FILE.ERROR_EMPTY';
  params: Record<string, string>;
}

// El separador decimal sigue el idioma de la app (el activo por defecto).
export function formatBytes(bytes: number, language: string = storedLanguage()): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat(language).format(rounded)} ${units[unit]}`;
}

export function acceptedTypesLabel(accept: readonly string[]): string {
  return accept.map((ext) => ext.replace('.', '').toUpperCase()).join(', ');
}

export function validateFile(file: Pick<File, 'name' | 'size'>, rules: FileRules): FileProblem | null {
  const name = file.name.toLowerCase();
  if (rules.accept.length > 0 && !rules.accept.some((ext) => name.endsWith(ext.toLowerCase()))) {
    return { key: 'COMMON.FILE.ERROR_TYPE', params: { types: acceptedTypesLabel(rules.accept) } };
  }
  if (file.size === 0) return { key: 'COMMON.FILE.ERROR_EMPTY', params: {} };
  if (file.size > rules.maxBytes) return { key: 'COMMON.FILE.ERROR_SIZE', params: { max: formatBytes(rules.maxBytes) } };
  return null;
}
