import { environment } from '@environments/environment';
import type { StatusTone } from '@shared/domain/models/status-tone.model';
import type { DocumentAssignmentCounts, MyDocumentStatus } from '../models/document.models';

/** El tono de cada estado de «Mis documentos»: por aceptar (aviso), aceptado (bien), vencido (mal). El texto siempre va junto: el color no es la única señal. */
export function myStatusTone(status: MyDocumentStatus): StatusTone {
  return status === 'accepted' ? 'ok' : status === 'overdue' ? 'bad' : 'warn';
}

/** Lo que falta por aceptar: por aceptar y vencidos juntos. */
export function outstanding(counts: DocumentAssignmentCounts): number {
  return counts.pending + counts.overdue;
}

/** Los tipos de archivo que se leen en pantalla: PDF e imágenes. Un DOCX solo se descarga (el servidor responde `422 disposition.not_inline`). */
const INLINE_TYPES: readonly string[] = ['application/pdf', 'image/png', 'image/jpeg'];
export function canReadInline(fileType: string | null | undefined): boolean {
  return !!fileType && INLINE_TYPES.includes(fileType.toLowerCase());
}

/** Solo https: nada de `javascript:` ni `data:` entra al visor, venga de donde venga el enlace. `http:` solo en desarrollo (el almacenamiento local no tiene TLS); en producción se rechaza. */
export function isHttpUrl(value: string, allowInsecure = !environment.production): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || (allowInsecure && protocol === 'http:');
  } catch {
    return false;
  }
}

/**
 * Baja un archivo con un enlace firmado sin abrir otra ventana: un `<a>` creado en el momento y pulsado. `window.open` dentro de la respuesta HTTP lo bloquean Safari y los bloqueadores de
 * ventanas emergentes (ya no es un gesto de la persona); el enlace de descarga (`attachment`) no abre pestaña ni deja la página.
 */
export function downloadFromUrl(url: string, fileName = ''): void {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  if (fileName) link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Hoy en `AAAA-MM-DD` (día local), para que la fecha de aprobación no sea futura. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
