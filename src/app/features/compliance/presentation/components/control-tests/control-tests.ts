import { storedLanguage } from '@core/domain/services/language.service';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDimensionDetail, ControlTechnical } from '@features/compliance/domain/models/control.models';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { TestFindings } from '../test-findings/test-findings';

export type ControlTest = NonNullable<ControlTechnical['tests']>[number];

/** Lo que recibe la plantilla de evidencia de cada prueba manual: su dimensión y la prueba a la que pertenece (D88). */
export interface EvidenceSlot {
  $implicit: string;
  testId: string;
  testCode: string;
}

// El estado de una prueba (`test_state`, enums.md) con el tono de estado del sistema (REQ-048): cumple es `ok`, no cumple es `bad`, pendiente, sin activos, en evaluación, en revisión,
// vencido o con error es `warn`, y no aplica o desactivado es `neutral`. El color nunca va solo: cada estado lleva su palabra junto al punto.
const TONES: Record<string, StatusTone> = {
  compliant: 'ok',
  non_compliant: 'bad',
  pending: 'warn',
  no_assets: 'warn',
  evaluating: 'warn',
  in_review: 'warn',
  expired: 'warn',
  error: 'warn',
  not_applicable: 'neutral',
  deactivated: 'neutral',
};

// Las pruebas que verifican un control, todas juntas: las documentales (manuales, que se cumplen con una evidencia entregada y validada) y las que valida la
// sonda sobre los activos conectados. Cada una con su dimensión, su tipo y si cumple o no. Un servicio sin activos conectados las muestra «Sin activos»,
// que no es un fallo: es lo que el control va a pedir. De cada prueba solo se ve su nombre neutro y su resultado (D70), nunca el texto del comité.
@Component({
  selector: 'app-control-tests',
  imports: [TranslatePipe, NgTemplateOutlet, TestFindings, StatusIndicator, Tag, DataTable, TableCell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="'COMPLIANCE.TESTS.TITLE' | translate">
      <h4 class="text-sm font-semibold text-ink">{{ 'COMPLIANCE.TESTS.TITLE' | translate }}@if (rows(); as list) { ({{ list.length }}) }</h4>

      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="mt-2 text-sm text-ink-muted">{{ 'COMPLIANCE.TESTS.NONE' | translate }}</p>
        } @else {
          <div class="mt-3">
          <app-data-table captionKey="COMPLIANCE.TESTS.TITLE" [compact]="true" [hideHeader]="true" [columns]="columns" [rows]="items()" [rowKey]="testKey">
            <ng-template appCell="test" let-t>
              <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold leading-snug text-ink"><app-tag class="mr-2 align-middle" [text]="t.test_code" />{{ t.display_name }}</p>
                    <p class="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{{ labels.of('COMPLIANCE.DIMENSION', t.dimension) }} · {{ t.kind }}</p>
                  </div>
                  <app-status-indicator [tone]="t.tone" [label]="labels.of('COMPLIANCE.TEST_STATE', t.state)" [attr.data-test-state]="t.state" />
                </div>
                @if (t.display_description) {
                  <div>
                    <p class="text-sm leading-relaxed text-ink-muted" [class.line-clamp-2]="!isOpen(t.test_code)" data-test-description>{{ t.display_description }}</p>
                    @if (t.display_description.length > LONG) {
                      <button type="button" class="mt-1 text-xs font-medium text-action hover:underline" [attr.aria-expanded]="isOpen(t.test_code)" (click)="toggle(t.test_code)">
                        {{ (isOpen(t.test_code) ? 'COMPLIANCE.TESTS.SHOW_LESS' : 'COMPLIANCE.TESTS.SHOW_MORE') | translate }}
                      </button>
                    }
                  </div>
                }
                <!-- D88 · La evidencia de una prueba documental es de ESTE control: se entrega y se valida bajo la prueba que respalda. -->
                <!-- D90 · Una prueba técnica que no cumple dice qué falló y cómo corregirlo. -->
                @if (AUTOMATED.includes(t.dimension) && t.state === 'non_compliant' && controlId(); as cid) {
                  <app-test-findings [controlId]="cid" [testId]="t.test_id" [dimension]="t.dimension" />
                }
                @if (t.manual && evidenceTpl(); as tpl) {
                  <div data-test-evidence>
                    <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: t.dimension, testId: t.test_id, testCode: t.test_code }" />
                  </div>
                }
              </div>
            </ng-template>
          </app-data-table>
          </div>
        }
      } @else {
        <!-- Sin el detalle de las pruebas (otros roles): al menos cuántas son, que es el denominador del avance. -->
        <p class="mt-2 text-sm text-ink-muted">{{ 'COMPLIANCE.TESTS.COUNT_ONLY' | translate: { count: total() } }}</p>
      }
    </section>
  `,
})
export class ControlTests {
  protected readonly labels = inject(EnumLabelService);
  /** Desde cuántos caracteres una descripción se recorta a dos líneas con «Ver más». */
  protected readonly LONG = 140;
  /** Las pruebas que mide una sonda (nube o servidores): las que no cumplen dicen qué falló y cómo corregirlo (D90). `policy` es documental. */
  protected readonly AUTOMATED: readonly string[] = ['cloud', 'server', 'database', 'app'];
  // Cada prueba es una fila de la lista compacta (la tabla única en su variante para paneles): una sola columna con todo lo suyo.
  protected readonly columns: TableColumn<{ test_code: string }>[] = [{ key: 'test', headerKey: 'COMPLIANCE.TESTS.TITLE' }];
  protected readonly testKey = (t: { test_code: string }) => t.test_code;
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
      .sort((a, b) => a.dimension.localeCompare(b.dimension, storedLanguage()) || a.test_code.localeCompare(b.test_code, storedLanguage(), { numeric: true }))
      .map((t) => ({ ...t, kind: this.labels.of('COMPLIANCE.CONTROL_TYPE', typeOf.get(t.dimension) ?? null), tone: TONES[t.state] ?? 'neutral' }));
  });
}
