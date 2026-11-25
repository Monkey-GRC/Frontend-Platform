import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { EvaluationPeriodItem } from '@features/compliance/domain/models/overview.models';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { Card } from '@shared/presentation/components/card/card';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Stage } from '../detail-panel-base/detail-panel-base';

// El histórico de períodos auditados cerrados de un servicio × marco (D145, D148): cuando un período termina, el siguiente se abre solo y el anterior queda aquí, sin cambios.
// Sin períodos cerrados no se muestra nada (no hay un bloque vacío). Solo lo piden el administrador de la empresa y el auditor; el resumen decide si lo monta.
@Component({
  selector: 'app-evaluation-period-history',
  imports: [TranslatePipe, Card, DataTable, TableCell, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (stage()) {
      @case ('loading') {
        <app-skeleton-region data-history-loading>
          <div class="flex flex-col gap-3"><app-skeleton shape="title" width="20%" /><app-skeleton shape="card" /></div>
        </app-skeleton-region>
      }
      @case ('error') {
        <app-card class="text-center" data-history-error>
          <p class="text-sm text-ink-muted">{{ 'COMPLIANCE.PERIOD.HISTORY_ERROR' | translate }}</p>
          <button type="button" (click)="load()" class="mk-btn-secondary-sm mt-3">{{ 'COMPLIANCE.PERIOD.HISTORY_RETRY' | translate }}</button>
        </app-card>
      }
      @default {
        @if (closed().length) {
          <section [attr.aria-label]="'COMPLIANCE.PERIOD.HISTORY_TITLE' | translate" data-history>
            <h2 class="text-base font-semibold text-ink">{{ 'COMPLIANCE.PERIOD.HISTORY_TITLE' | translate }}</h2>
            <p class="mb-3 mt-0.5 text-sm text-ink-muted">{{ 'COMPLIANCE.PERIOD.HISTORY_INTRO' | translate }}</p>
            <app-data-table captionKey="COMPLIANCE.PERIOD.HISTORY_CAPTION" [columns]="columns" [rows]="closed()" [rowKey]="rowKey">
              <ng-template appCell="period" let-row><span class="tabular-nums">{{ 'COMPLIANCE.REQS.PERIOD_RANGE' | translate: { from: day(row.period_start), to: day(row.period_end) } }}</span></ng-template>
              <ng-template appCell="opened" let-row>{{ (row.opened_by === 'system' ? 'COMPLIANCE.PERIOD.OPENED_BY_SYSTEM' : 'COMPLIANCE.PERIOD.OPENED_BY_USER') | translate }}</ng-template>
              <ng-template appCell="closed" let-row><span class="tabular-nums">{{ closedAt(row.closed_at) }}</span></ng-template>
            </app-data-table>
          </section>
        }
      }
    }
  `,
})
export class EvaluationPeriodHistory {
  private readonly api = inject(OverviewService);
  private readonly language = inject(LanguageService);

  readonly serviceId = input.required<string>();
  readonly frameworkCode = input.required<string>();

  protected readonly stage = signal<Stage>('loading');
  private readonly periods = signal<EvaluationPeriodItem[]>([]);
  protected readonly closed = computed(() => this.periods().filter((p) => p.status === 'closed'));

  protected readonly columns: TableColumn<EvaluationPeriodItem>[] = [
    { key: 'period', headerKey: 'COMPLIANCE.PERIOD.HISTORY_COL_PERIOD' },
    { key: 'opened', headerKey: 'COMPLIANCE.PERIOD.HISTORY_COL_OPENED' },
    { key: 'closed', headerKey: 'COMPLIANCE.PERIOD.HISTORY_COL_CLOSED' },
  ];
  protected readonly rowKey = (p: EvaluationPeriodItem): string => p.id;
  private seq = 0;

  constructor() {
    effect(() => {
      this.serviceId();
      this.frameworkCode();
      untracked(() => this.load());
    });
  }

  load(): void {
    const seq = ++this.seq;
    this.stage.set('loading');
    this.api.listEvaluationPeriods(this.serviceId(), this.frameworkCode()).subscribe({
      next: (list) => {
        if (seq !== this.seq) return;
        this.periods.set(list);
        this.stage.set('ready');
      },
      error: () => seq === this.seq && this.stage.set('error'),
    });
  }

  /** Cuándo se cerró (un instante, en la zona del navegador). */
  protected closedAt(value: string | null): string {
    return formatLocalDate(value, this.language.current()) || '—';
  }

  /** Días `AAAA-MM-DD` en el idioma de la sesión, sin que la zona horaria los corra. */
  protected day(value: string): string {
    return formatLocalDate(value, this.language.current(), { calendar: true });
  }
}
