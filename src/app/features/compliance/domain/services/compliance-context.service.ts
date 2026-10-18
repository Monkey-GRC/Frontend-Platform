import { Injectable, signal } from '@angular/core';

// Lo que la pestaña Resumen y el encabezado de Cumplimiento se cuentan entre sí. El encabezado (del servicio) muestra los marcos contratados y el período de la evaluación, pero
// ese dato lo conoce el Resumen (que pide el cumplimiento del servicio); y elegir el marco, que se hace en el encabezado, lo usa el Resumen. Solo vive mientras el Resumen está abierto.
@Injectable({ providedIn: 'root' })
export class ComplianceContextService {
  /** El Resumen está abierto y el servicio tiene más de un marco: en el encabezado, los marcos se pueden elegir. */
  readonly selectable = signal(false);
  /** El marco elegido (su código); `null` mientras el Resumen no ha cargado. */
  readonly selected = signal<string | null>(null);
  /** El período de la evaluación del marco elegido, ya escrito para el idioma de la sesión; `null` si no está definido. */
  readonly evaluationText = signal<string | null>(null);
  /** El encabezado ya muestra los marcos (solo el administrador conoce la lista de servicios): si no, el Resumen trae sus propios botones. */
  readonly headerShowsFrameworks = signal(false);

  clear(): void {
    this.selectable.set(false);
    this.selected.set(null);
    this.evaluationText.set(null);
  }
}
