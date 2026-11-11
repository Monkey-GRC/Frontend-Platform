import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';

// Lo que la pestaña Resumen y el encabezado de Cumplimiento se cuentan entre sí. El encabezado (del servicio) muestra los marcos contratados y el período de la evaluación, pero
// ese dato lo conoce el Resumen (que pide el cumplimiento del servicio); y elegir el marco, que se hace en el encabezado, lo usa el Resumen. Solo vive mientras el Resumen está abierto.
/** La línea de contexto del banner: un conteo que la sección ya tiene cargado, o el estado del marco en el Resumen. Son claves i18n: el banner las traduce. */
export type ComplianceInsight = { kind: 'count'; labelKey: string; count: number } | { kind: 'status'; statusKey: string; hintKey: string };

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

  /** La línea corta que cada sección le cuenta al banner, con datos que ya cargó; `null` si no tiene ninguno. */
  readonly insight = signal<ComplianceInsight | null>(null);
  /** Abre el cambio de período; la define el Resumen solo cuando se puede cambiar (administrador y período ya definido). */
  readonly editPeriod = signal<(() => void) | null>(null);

  clear(): void {
    this.insight.set(null);
    this.editPeriod.set(null);
    this.selectable.set(false);
    this.selected.set(null);
    this.evaluationText.set(null);
  }
}

/** Una sección publica su línea de contexto en el banner mientras está abierta (debe llamarse en un contexto de inyección). Sin dato, no se publica nada. */
export function bindInsight(compute: () => ComplianceInsight | null): void {
  const context = inject(ComplianceContextService);
  effect(() => {
    const value = compute();
    untracked(() => context.insight.set(value));
  });
  inject(DestroyRef).onDestroy(() => context.insight.set(null));
}
