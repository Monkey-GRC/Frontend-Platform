import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { ControlPeriod } from '@features/compliance/domain/models/control.models';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';

type MissingWindow = ControlPeriod['missing'][number];

// El control en el período auditado abierto (MD-500, R6; su propia pestaña del detalle desde MD-499): el nivel del período, cuántas ventanas ya cerradas tienen
// evidencia válida y cuáles no. La cabecera del detalle muestra la vista a la fecha; esta es la del período. Todo viene calculado por el backend.
@Component({
  selector: 'app-control-period',
  imports: [TranslatePipe, DataTable, TableCell, StatusIndicator, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = period();
    <!-- A lo ancho (MD-499): el nivel y las ventanas del período a la izquierda; las ventanas cerradas sin evidencia, a la derecha. -->
    <section class="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" data-period [attr.aria-label]="'COMPLIANCE.REQS.PERIOD_TITLE' | translate">
      <div class="flex flex-col gap-5">
        <p class="max-w-prose text-pretty text-sm text-ink-muted">{{ 'COMPLIANCE.REQS.PERIOD_INTRO' | translate }}</p>
        <dl class="flex flex-wrap gap-x-10 gap-y-4">
          <div class="flex flex-col items-start gap-1">
            <dt class="text-xs font-medium text-ink-faint">{{ 'COMPLIANCE.REQS.PERIOD_LEVEL' | translate }}</dt>
            <dd><app-status-indicator [tone]="p.complies ? 'ok' : 'warn'" [label]="labels.of('COMPLIANCE.CONTROL_LEVEL', p.level)" data-period-level /></dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="text-xs font-medium text-ink-faint">{{ 'COMPLIANCE.REQS.PERIOD_WINDOWS_TITLE' | translate }}</dt>
            <dd class="text-sm tabular-nums text-ink">{{ 'COMPLIANCE.REQS.PERIOD_WINDOWS_VALUE' | translate: { with_evidence: p.windows.with_evidence, total: p.windows.total } }}</dd>
          </div>
        </dl>
      </div>
      @if (p.missing.length) {
      <div class="min-w-0">
        <h3 class="mb-2 text-sm font-semibold text-ink">{{ 'COMPLIANCE.REQS.PERIOD_MISSING' | translate: { count: p.missing.length } }}</h3>
        <app-data-table captionKey="COMPLIANCE.REQS.PERIOD_TITLE" [compact]="true" [columns]="columns" [rows]="p.missing" [rowKey]="missingKey">
          <ng-template appCell="requirement" let-m><app-tag [text]="m.requirement_code" /></ng-template>
          <ng-template appCell="window" let-m><span class="tabular-nums">{{ 'COMPLIANCE.REQS.PERIOD_RANGE' | translate: { from: date(m.window_start), to: date(m.window_end) } }}</span></ng-template>
        </app-data-table>
      </div>
      } @else {
      <p class="mk-surface-state-ok p-4 text-sm text-ink" data-period-complete>{{ 'COMPLIANCE.REQS.PERIOD_NONE_MISSING' | translate }}</p>
      }
    </section>
  `,
})
export class ControlPeriodView {
  protected readonly labels = inject(EnumLabelService);
  private readonly language = inject(LanguageService);

  readonly period = input.required<ControlPeriod>();

  protected readonly columns: TableColumn<MissingWindow>[] = [
    { key: 'requirement', headerKey: 'COMPLIANCE.REQS.PERIOD_COL_REQUIREMENT' },
    { key: 'window', headerKey: 'COMPLIANCE.REQS.PERIOD_COL_WINDOW' },
  ];
  protected readonly missingKey = (m: MissingWindow) => `${m.requirement_code}|${m.window_start}`;

  /** Una fecha `AAAA-MM-DD` del backend, en el idioma de la sesión y sin correrla un día por la zona horaria. */
  protected date(iso: string): string {
    return formatLocalDate(iso, this.language.current(), { calendar: true }) || iso;
  }
}
