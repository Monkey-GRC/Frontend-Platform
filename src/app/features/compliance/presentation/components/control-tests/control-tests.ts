import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDimensionDetail, ControlTechnical } from '../../../domain/models/control.models';
import { EnumLabelService } from '../../../domain/services/enum-label.service';

export type ControlTest = NonNullable<ControlTechnical['tests']>[number];

interface Look {
  icon: string;
  chip: string;
}

// El estado de una prueba (`test_state`, enums.md) con los colores estándar (REQ-048): verde cumple, rojo no cumple, amarillo pendiente o sin activos,
// naranja en evaluación, en revisión, vencido o con error, gris no aplica o desactivado. El color nunca va solo: cada estado lleva su ícono y su texto.
const LOOKS: Record<string, Look> = {
  compliant: { icon: 'check_circle', chip: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300' },
  non_compliant: { icon: 'cancel', chip: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-300' },
  pending: { icon: 'schedule', chip: 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/25 dark:bg-yellow-900/30 dark:text-yellow-300' },
  no_assets: { icon: 'link_off', chip: 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/25 dark:bg-yellow-900/30 dark:text-yellow-300' },
  evaluating: { icon: 'sync', chip: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-900/30 dark:text-orange-300' },
  in_review: { icon: 'rate_review', chip: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-900/30 dark:text-orange-300' },
  expired: { icon: 'event_busy', chip: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-900/30 dark:text-orange-300' },
  error: { icon: 'error', chip: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-900/30 dark:text-orange-300' },
  not_applicable: { icon: 'remove_circle_outline', chip: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-400/30 dark:bg-gray-800 dark:text-gray-300' },
  deactivated: { icon: 'block', chip: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-400/30 dark:bg-gray-800 dark:text-gray-300' },
};
const UNKNOWN: Look = { icon: 'help', chip: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-400/30 dark:bg-gray-800 dark:text-gray-300' };

// Las pruebas que verifican un control, todas juntas: las documentales (manuales, que se cumplen con una evidencia entregada y validada) y las que valida la
// sonda sobre los activos conectados. Cada una con su dimensión, su tipo y si cumple o no. Un servicio sin activos conectados las muestra «Sin activos»,
// que no es un fallo: es lo que el control va a pedir. De cada prueba solo se ve su nombre neutro y su resultado (D70), nunca el texto del comité.
@Component({
  selector: 'app-control-tests',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="'COMPLIANCE.TESTS.TITLE' | translate">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ 'COMPLIANCE.TESTS.TITLE' | translate }}@if (rows(); as list) { ({{ list.length }}) }</h4>

      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.TESTS.NONE' | translate }}</p>
        } @else {
          <ul class="mt-2 flex flex-col gap-2">
            @for (t of list; track t.test_code) {
              <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                <div class="min-w-0 text-sm">
                  <p class="text-gray-900 dark:text-white"><span class="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">{{ t.test_code }}</span> · {{ t.display_name }}</p>
                  <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{{ labels.of('COMPLIANCE.DIMENSION', t.dimension) }} · {{ t.kind }}</p>
                </div>
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" [class]="t.look.chip" [attr.data-test-state]="t.state">
                  <span class="material-symbols-rounded text-[14px] leading-none" aria-hidden="true">{{ t.look.icon }}</span>{{ labels.of('COMPLIANCE.TEST_STATE', t.state) }}
                </span>
              </li>
            }
          </ul>
        }
      } @else {
        <!-- Sin el detalle de las pruebas (otros roles): al menos cuántas son, que es el denominador del avance. -->
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.TESTS.COUNT_ONLY' | translate: { count: total() } }}</p>
      }
    </section>
  `,
})
export class ControlTests {
  protected readonly labels = inject(EnumLabelService);

  /** Las pruebas del control (vista técnica). `null`/`undefined` = esta vista no las trae. */
  readonly tests = input<ControlTest[] | null | undefined>(null);
  /** Las dimensiones del control: de ahí sale si cada prueba es manual o automática. */
  readonly dimensions = input<ControlDimensionDetail[]>([]);
  /** Cuántas pruebas cuenta el avance, para decirlo cuando no hay detalle. */
  readonly total = input(0);

  protected readonly rows = computed(() => {
    const list = this.tests();
    if (!list) return null;
    const typeOf = new Map(this.dimensions().map((d) => [d.dimension, d.type]));
    return [...list]
      .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.test_code.localeCompare(b.test_code, 'es', { numeric: true }))
      .map((t) => ({ ...t, kind: this.labels.of('COMPLIANCE.CONTROL_TYPE', typeOf.get(t.dimension) ?? null), look: LOOKS[t.state] ?? UNKNOWN }));
  });
}
