import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { bindInsight } from '@features/compliance/domain/services/compliance-context.service';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { Exclusion, ExclusionStatus } from '@features/compliance/domain/models/exclusion.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { ExclusionService } from '@features/compliance/domain/services/exclusion.service';

type Stage = 'loading' | 'error' | 'forbidden' | 'ready';

// Las exclusiones del servicio (MD-144, D96): sacar un activo del universo de una prueba. La crea y la decide el administrador de la empresa en un solo acto: nace aprobada y el
// activo deja de medirse en esa prueba hasta que venza (el fin del período). El administrador y el auditor las leen. Crear una desde un control está por construir.
@Component({
  selector: 'app-exclusions',
  imports: [TranslatePipe, LoadingSpinner, DataTable, TableCell, TableToolbar, OptionChips, EmptyState, StatusIndicator],
  templateUrl: './exclusions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExclusionsView implements OnInit {
  private readonly api = inject(ExclusionService);
  private readonly language = inject(LanguageService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // El servicio activo lo elige el encabezado de Cumplimiento y se recuerda entre secciones (`ActiveComplianceService`).
  private readonly activeService = inject(ActiveComplianceService);
  readonly serviceId = computed(() => this.activeService.serviceId() ?? '');

  // Los estados de una exclusión salen del backend (enum de Postgres `exclusion_status`).
  readonly statuses = toSignal(inject(CatalogService).options('exclusion_status'), { initialValue: [] });
  readonly stage = signal<Stage>('loading');
  readonly all = signal<Exclusion[]>([]);
  readonly filter = signal<ExclusionStatus | null>(null);
  readonly items = computed(() => {
    const f = this.filter();
    return f ? this.all().filter((e) => e.status === f) : this.all();
  });

  /** Los filtros: «Todas» y los estados que sirve el backend, cada uno con su conteo. */
  readonly chips = computed(() => [
    { value: 'all', label: `${this.labels.of('COMPLIANCE.EXCLUSIONS', 'ALL')} (${this.all().length})` },
    ...this.statuses().map((s) => ({ value: s.value, label: `${s.label} (${this.count(s.value as ExclusionStatus)})` })),
  ]);

  protected readonly columns: TableColumn<Exclusion>[] = [
    { key: 'test', headerKey: 'COMPLIANCE.EXCLUSIONS.COL_TEST' },
    { key: 'justification', headerKey: 'COMPLIANCE.EXCLUSIONS.JUSTIFICATION' },
    { key: 'status', headerKey: 'COMPLIANCE.EXCLUSIONS.COL_STATUS' },
    { key: 'validity', headerKey: 'COMPLIANCE.EXCLUSIONS.VALIDITY', class: 'whitespace-nowrap' },
    { key: 'people', headerKey: 'COMPLIANCE.EXCLUSIONS.CREATED_BY' },
  ];
  protected readonly byId = (e: Exclusion): string => e.id;

  /** Aprobada cuenta como correcta, rechazada como mala y pendiente como por decidir; el texto siempre va junto al punto. */
  protected tone(status: ExclusionStatus): StatusTone {
    return status === 'approved' ? 'ok' : status === 'rejected' ? 'bad' : 'warn';
  }

  constructor() {
    bindInsight(() => (this.stage() === 'ready' ? { kind: 'count', labelKey: 'COMPLIANCE.BANNER.EXCLUSIONS', count: this.all().length } : null));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.listAll(this.serviceId()).subscribe({
      next: (items) => {
        this.all.set(items);
        this.stage.set('ready');
      },
      error: (e: unknown) => this.stage.set(e instanceof HttpErrorResponse && e.status === 403 ? 'forbidden' : 'error'),
    });
  }

  pick(value: string): void {
    this.filter.set(value === 'all' || value === this.filter() ? null : (value as ExclusionStatus));
  }

  count(status: ExclusionStatus): number {
    return this.all().filter((e) => e.status === status).length;
  }

  fullName(p: { name: string | null; last_name: string | null } | null): string {
    return p ? [p.name, p.last_name].filter(Boolean).join(' ') : '';
  }

  /** `AAAA-MM-DD` es un día, sin hora ni zona: se muestra ese día en UTC para que no corra por la zona horaria. */
  day(value: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }
}
