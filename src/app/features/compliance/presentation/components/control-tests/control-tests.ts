import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDimensionDetail, ControlTechnical } from '../../../domain/models/control.models';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { TestFindings } from '../test-findings/test-findings';

export type ControlTest = NonNullable<ControlTechnical['tests']>[number];

/** Lo que recibe la plantilla de evidencia de cada prueba manual: su dimensión y la prueba a la que pertenece (D88). */
export interface EvidenceSlot {
  $implicit: string;
  testId: string;
  testCode: string;
}

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
  imports: [TranslatePipe, NgTemplateOutlet, TestFindings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="'COMPLIANCE.TESTS.TITLE' | translate">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ 'COMPLIANCE.TESTS.TITLE' | translate }}@if (rows(); as list) { ({{ list.length }}) }</h4>

      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.TESTS.NONE' | translate }}</p>
        } @else {
          <ul class="mt-3 flex flex-col divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            @for (t of items(); track t.test_code) {
              <li class="flex flex-col gap-2 py-4">
                <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold leading-snug text-gray-900 dark:text-white"><span class="mr-2 inline-block rounded-md bg-gray-100 px-1.5 py-0.5 align-middle font-mono text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{{ t.test_code }}</span>{{ t.display_name }}</p>
                    <p class="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ labels.of('COMPLIANCE.DIMENSION', t.dimension) }} · {{ t.kind }}</p>
                  </div>
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium" [class]="t.look.chip" [attr.data-test-state]="t.state">
                    <span class="material-symbols-rounded text-[14px] leading-none" aria-hidden="true">{{ t.look.icon }}</span>{{ labels.of('COMPLIANCE.TEST_STATE', t.state) }}
                  </span>
                </div>
                @if (t.display_description) {
                  <div>
                    <p class="text-sm leading-relaxed text-gray-700 dark:text-gray-200" [class.line-clamp-2]="!isOpen(t.test_code)" data-test-description>{{ t.display_description }}</p>
                    @if (t.display_description.length > LONG) {
                      <button type="button" class="mt-1 text-xs font-medium text-primary hover:underline" [attr.aria-expanded]="isOpen(t.test_code)" (click)="toggle(t.test_code)">
                        {{ (isOpen(t.test_code) ? 'COMPLIANCE.TESTS.SHOW_LESS' : 'COMPLIANCE.TESTS.SHOW_MORE') | translate }}
                      </button>
                    }
                  </div>
                }
                <!-- D88 · La evidencia de una prueba documental es de ESTE control: se entrega y se valida bajo la prueba que respalda. -->
                <!-- D90 · Una prueba técnica que no cumple dice qué falló y cómo corregirlo. -->
                @if (t.dimension === 'cloud' && t.state === 'non_compliant' && controlId(); as cid) {
                  <app-test-findings [controlId]="cid" [testId]="t.test_id" />
                }
                @if (t.manual && evidenceTpl(); as tpl) {
                  <div data-test-evidence>
                    <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: t.dimension, testId: t.test_id, testCode: t.test_code }" />
                  </div>
                }
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
  /** Desde cuántos caracteres una descripción se recorta a dos líneas con «Ver más». */
  protected readonly LONG = 140;
  private readonly opened = signal<ReadonlySet<string>>(new Set());

  protected isOpen(code: string): boolean {
    return this.opened().has(code);
  }

  protected toggle(code: string): void {
    this.opened.update((s) => {
      const next = new Set(s);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  /** Las pruebas del control (vista técnica). `null`/`undefined` = esta vista no las trae. */
  readonly tests = input<ControlTest[] | null | undefined>(null);
  /** Las dimensiones del control: de ahí sale si cada prueba es manual o automática. */
  readonly dimensions = input<ControlDimensionDetail[]>([]);
  /** Cuántas pruebas cuenta el avance, para decirlo cuando no hay detalle. */
  readonly total = input(0);
  /** La evidencia de cada prueba manual (D88): se pinta bajo CADA prueba de una dimensión manual, con el id y el código de esa prueba. */
  readonly evidenceTpl = input<TemplateRef<EvidenceSlot> | null>(null);
  /** El control al que pertenecen las pruebas: con él, una prueba técnica que no cumple puede decir qué falló y cómo corregirlo (D90). */
  readonly controlId = input<string | null>(null);

  /** Las pruebas en el orden de `rows`, cada una con si es manual (de ahí sale si lleva su evidencia debajo). */
  protected readonly items = computed(() => {
    const list = this.rows() ?? [];
    const typeOf = new Map(this.dimensions().map((d) => [d.dimension, d.type]));
    return list.map((t) => ({ ...t, manual: typeOf.get(t.dimension) === 'manual' }));
  });

  protected readonly rows = computed(() => {
    const list = this.tests();
    if (!list) return null;
    const typeOf = new Map(this.dimensions().map((d) => [d.dimension, d.type]));
    return [...list]
      .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.test_code.localeCompare(b.test_code, 'es', { numeric: true }))
      .map((t) => ({ ...t, kind: this.labels.of('COMPLIANCE.CONTROL_TYPE', typeOf.get(t.dimension) ?? null), look: LOOKS[t.state] ?? UNKNOWN }));
  });
}
