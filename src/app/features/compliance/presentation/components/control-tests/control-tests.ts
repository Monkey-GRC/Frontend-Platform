import { storedLanguage } from '@core/domain/services/language.service';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDimensionDetail, ControlTechnical, EvidenceTest } from '@features/compliance/domain/models/control.models';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { TestFindings } from '../test-findings/test-findings';

export type ControlTest = NonNullable<ControlTechnical['tests']>[number];

/** Lo que se muestra a la derecha de una prueba (MD-499). */
type TestAside = 'evidence' | 'findings' | 'automated' | 'none';

/** Lo que recibe la plantilla de evidencia de cada prueba manual: su dimensión y la prueba a la que pertenece (D88). */
export interface EvidenceSlot {
  $implicit: string;
  testId: string;
  testCode: string;
  fallback: boolean;
}

// El estado de una prueba (`test_status`, enums.md) con el tono de estado del sistema: correcto es `ok`, excepción es `bad`, pendiente, observación o vencido es `warn`
// y no aplica es `neutral`. El color nunca va solo: cada estado lleva su palabra junto al punto.
const TONES: Record<string, StatusTone> = {
  correct: 'ok',
  exception: 'bad',
  pending: 'warn',
  observation: 'warn',
  expired: 'warn',
  not_applicable: 'neutral',
};

// Las pruebas que verifican un control, todas juntas: las documentales (manuales, que se cumplen con una evidencia entregada y validada) y las que valida la
// sonda sobre los activos conectados. Cada una con su dimensión, su tipo y si cumple o no. Un servicio sin activos conectados las muestra «Sin activos»,
// que no es un fallo: es lo que el control va a pedir. De cada prueba solo se ve su nombre neutro y su resultado (D70), nunca el texto del comité.
@Component({
  selector: 'app-control-tests',
  imports: [TranslatePipe, NgTemplateOutlet, TestFindings, StatusIndicator, Tag, DataTable, TableCell, ExpandableText, SearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="'COMPLIANCE.TESTS.TITLE' | translate">
      <h4 class="text-sm font-semibold text-ink">{{ 'COMPLIANCE.TESTS.TITLE' | translate }}@if (rows(); as list) { ({{ list.length }}) }</h4>
      <!-- El único texto de introducción: quien puede subir lee cómo; quien no, qué verifican las pruebas. -->
      <p class="mt-1 max-w-prose text-pretty text-sm text-ink-muted" data-evidence-help>{{ (canUpload() ? 'COMPLIANCE.EVIDENCE.TEST_NOTE' : 'COMPLIANCE.REQUIRES.INTRO') | translate }}</p>

      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="mt-2 text-sm text-ink-muted">{{ 'COMPLIANCE.TESTS.NONE' | translate }}</p>
        } @else {
          <div class="mt-3">
          <app-search-field class="mb-4 block w-full" inputId="control-tests-search" placeholderKey="COMPLIANCE.TESTS.SEARCH" [value]="paged.query()" (valueChange)="paged.search($event)" data-tests-search />
          <app-data-table captionKey="COMPLIANCE.TESTS.TITLE" [compact]="true" [hideHeader]="true" [columns]="columns" [rows]="paged.rows()" [rowKey]="testKey"
            [page]="paged.info()" [pageSizes]="[10, 25]" emptyIcon="" emptyTitleKey="COMPLIANCE.TESTS.NO_MATCH" (pageChange)="paged.goTo($event)" (pageSizeChange)="paged.resize($event)">
            <ng-template appCell="test" let-t>
              <!-- MD-499 · Todas las pruebas con la misma estructura: la prueba a la izquierda y, a la derecha, cómo se cumple: su evidencia (D88), lo que falló (D90)
                   o, si no se sube nada desde aquí, por qué. -->
              <div class="grid items-stretch gap-x-8 gap-y-4 px-2 py-2.5 lg:grid-cols-2" [attr.data-aside]="t.aside">
                <div class="flex min-w-0 flex-col gap-2 self-start">
                  <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold leading-snug text-ink"><app-tag class="mr-2 align-middle" [text]="t.test_code" />{{ t.display_name }}</p>
                      <p class="mt-1 text-xs font-medium text-ink-faint">{{ labels.of('COMPLIANCE.DIMENSION', t.dimension) }}@if (t.kind) { · {{ t.kind }}}</p>
                    </div>
                    <app-status-indicator [tone]="t.tone" [label]="labels.of('COMPLIANCE.TEST_STATUS', t.status)" [attr.data-test-state]="t.status" />
                  </div>
                  @if (t.display_description) {
                    <app-expandable-text class="max-w-prose" [text]="t.display_description" textClass="text-pretty text-sm leading-relaxed text-ink-muted"
                      moreKey="COMPLIANCE.TESTS.SHOW_MORE" lessKey="COMPLIANCE.TESTS.SHOW_LESS" data-test-description />
                  }
                </div>
                <!-- El bloque de la derecha ocupa el alto de la tarjeta, con su contenido centrado: título y estado arriba, el texto y la acción abajo (Rod). -->
                <div class="flex min-w-0 flex-col">
                  @switch (t.aside) {
                    @case ('findings') {
                      <!-- D90 · Una prueba técnica que no cumple dice qué falló y cómo corregirlo. -->
                      @if (controlId(); as cid) {
                        <div class="flex flex-1 flex-col items-center justify-center gap-2 rounded-control border border-line px-4 py-5 text-center" data-test-findings-block>
                          <div class="flex flex-wrap items-center justify-center gap-2">
                            <p class="text-sm font-semibold text-ink">{{ 'COMPLIANCE.TESTS.FINDINGS_TITLE' | translate }}</p>
                            <app-status-indicator tone="bad" [label]="labels.of('COMPLIANCE.TEST_STATUS', t.status)" />
                          </div>
                          <p class="max-w-prose text-pretty text-sm text-ink-muted">{{ 'COMPLIANCE.TESTS.FINDINGS_TEXT' | translate }}</p>
                          <app-test-findings class="mt-1 w-full" [controlId]="cid" [testId]="t.test_id" [dimension]="t.dimension" />
                        </div>
                      }
                    }
                    @case ('evidence') {
                      <!-- D88 · La evidencia de una prueba documental es de ESTE control: se entrega y se valida bajo la prueba que respalda. -->
                      @if (evidenceTpl(); as tpl) {
                        <div class="flex flex-1 flex-col" data-test-evidence>
                          <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: t.dimension, testId: t.test_id, testCode: t.test_code, fallback: t.evidence_fallback }" />
                        </div>
                      }
                    }
                    @default {
                      <!-- Nada que subir desde aquí: se dice cómo se cumple, con la misma caja que la evidencia. -->
                      <div class="flex flex-1 flex-col items-center justify-center gap-2 rounded-control border border-line px-4 py-5 text-center" data-test-how>
                        <p class="text-sm font-semibold text-ink">{{ 'COMPLIANCE.TESTS.HOW_TITLE' | translate }}</p>
                        <p class="max-w-prose text-pretty text-sm text-ink-muted">{{ (t.aside === 'automated' ? 'COMPLIANCE.TESTS.HOW_AUTOMATED' : 'COMPLIANCE.TESTS.HOW_NO_UPLOAD') | translate }}</p>
                      </div>
                    }
                  }
                </div>
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
  /** Las pruebas que mide una sonda (nube o servidores): las que no cumplen dicen qué falló y cómo corregirlo (D90). `policy` es documental. */
  protected readonly AUTOMATED: readonly string[] = ['cloud', 'server', 'database', 'app'];
  // Cada prueba es una fila de la lista compacta (la tabla única en su variante para paneles): una sola columna con todo lo suyo.
  protected readonly columns: TableColumn<{ test_code: string }>[] = [{ key: 'test', headerKey: 'COMPLIANCE.TESTS.TITLE' }];
  protected readonly testKey = (t: { test_code: string }) => t.test_code;

  /** Las pruebas del control (vista técnica). `null`/`undefined` = esta vista no las trae. */
  readonly tests = input<ControlTest[] | null | undefined>(null);
  /** Las pruebas que aceptan evidencia, para quien no ve la vista técnica (MD-499). */
  readonly evidenceTests = input<EvidenceTest[] | null | undefined>(null);
  /** Las dimensiones del control: de ahí sale si cada prueba es manual o automática. */
  readonly dimensions = input<ControlDimensionDetail[]>([]);
  /** Cuántas pruebas cuenta el avance, para decirlo cuando no hay detalle. */
  readonly total = input(0);
  /** ¿Puede este rol subir evidencia? Decide cuál es la introducción. */
  readonly canUpload = input(false);
  /** La evidencia de cada prueba manual (D88): se pinta bajo CADA prueba de una dimensión manual, con el id y el código de esa prueba. */
  readonly evidenceTpl = input<TemplateRef<EvidenceSlot> | null>(null);
  /** El control al que pertenecen las pruebas: con él, una prueba técnica que no cumple puede decir qué falló y cómo corregirlo (D90). */
  readonly controlId = input<string | null>(null);

  /** Las pruebas en el orden de `rows`, cada una con si es manual (de ahí sale si lleva su evidencia debajo). */
  protected readonly items = computed(() => {
    const list = this.rows() ?? [];
    return list.map((t) => {
      const manual = t.accepts_evidence;
      const automated = this.AUTOMATED.includes(t.dimension);
      // Qué va a la derecha de la prueba. Solo una prueba que acepta evidencia (`accepts_evidence`, MD-499) lleva subida (D88); una automática que no cumple dice qué falló (D90);
      // el resto (automática que cumple o sin medir, o una que no acepta evidencia) dice cómo se cumple.
      const aside: TestAside = !manual && automated && t.status === 'exception' && !!this.controlId() ? 'findings' : manual && !!this.evidenceTpl() ? 'evidence' : automated ? 'automated' : 'none';
      return { ...t, manual, aside };
    });
  });

  protected readonly paged = new ClientList(
    this.items,
    (t, q) => includesText(q, t.test_code, t.display_name, t.display_description),
  );

  /** ¿Alguna prueba lleva su evidencia al lado? Entonces la instrucción se dice una vez arriba. */

  private readonly fromEvidenceTests = computed<ControlTest[] | null>(() => {
    const list = this.evidenceTests();
    if (!list || list.length === 0) return null;
    return list.map((t) => ({ test_id: t.test_id, test_code: t.test_code, display_name: t.display_name, dimension: t.dimension, status: t.status, accepts_evidence: true, evidence_fallback: t.evidence_fallback }));
  });

  protected readonly rows = computed(() => {
    const list = this.tests() ?? this.fromEvidenceTests();
    if (!list) return null;
    const typeOf = new Map(this.dimensions().map((d) => [d.dimension, d.type]));
    return [...list]
      .sort((a, b) => a.dimension.localeCompare(b.dimension, storedLanguage()) || a.test_code.localeCompare(b.test_code, storedLanguage(), { numeric: true }))
      .map((t) => {
        // Sin tipo conocido no se muestra nada (nunca un guion suelto).
        const type = typeOf.get(t.dimension);
        return { ...t, kind: type ? this.labels.of('COMPLIANCE.CONTROL_TYPE', type) : null, tone: TONES[t.status] ?? 'neutral' };
      });
  });
}
