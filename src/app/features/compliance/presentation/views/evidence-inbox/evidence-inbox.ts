import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Tag } from '@shared/presentation/components/tag/tag';
import { COMPLIANCE_ROUTE } from '@features/compliance/domain/models/compliance.models';
import { bindInsight } from '@features/compliance/domain/services/compliance-context.service';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { ControlListItem } from '@features/compliance/domain/models/control.models';
import {
  EVIDENCE_FILTERS,
  EvidenceFilter,
  EvidenceInboxRow,
  EvidenceRequirement,
  buildInboxRows,
  evidenceStateTone,
  evidenceFilterOf,
} from '@features/compliance/domain/models/evidence.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { ControlDetailPanel } from '../../components/control-detail-panel/control-detail-panel';
import { Stage } from '../../components/detail-panel-base/detail-panel-base';

// La pestaña «Evidencias» de un servicio (MD-129): todo lo que los controles piden que se aporte, con su responsable y el estado de la última entrega,
// para ver de un vistazo qué falta. Subir y descargar se hace en el panel del control (se abre con un clic en la fila), con el mismo componente de evidencia
// del control. La bandeja solo muestra (D96): no hay botones de aprobar ni rechazar aquí; el estado lo calcula el servidor a partir de la revisión del administrador de la empresa.
// Hoy lo ve el administrador de la empresa; el detalle por rol espera a los permisos por pantalla (P3).
@Component({
  selector: 'app-evidence-inbox',
  imports: [Tag, TranslatePipe, DataTable, TableCell, TableToolbar, OptionChips, EmptyState, StatusIndicator, ControlDetailPanel],
  templateUrl: './evidence-inbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidenceInboxView {
  private readonly controlsApi = inject(ControlService);
  private readonly api = inject(EvidenceService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);
  private readonly router = inject(Router);

  // El servicio activo lo elige el encabezado de Cumplimiento y se recuerda entre secciones (`ActiveComplianceService`).
  private readonly activeService = inject(ActiveComplianceService);
  readonly serviceId = computed(() => this.activeService.serviceId() ?? '');

  readonly stage = signal<Stage>('loading');
  readonly selected = signal<string | null>(null);
  readonly filter = signal<EvidenceFilter>('all');

  private readonly controls = signal<ControlListItem[]>([]);
  private readonly evidence = signal<ReadonlyMap<string, EvidenceRequirement[]>>(new Map());
  private requestSeq = 0;

  readonly rows = computed(() => buildInboxRows(this.controls().map((c) => ({ id: c.id, name: c.name, code: c.code })), this.evidence()));
  readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((r) => evidenceFilterOf(r) === f);
  });
  private readonly counts = computed(() => {
    const c: Record<EvidenceFilter, number> = { all: this.rows().length, missing: 0, to_review: 0, reviewed: 0 };
    for (const r of this.rows()) c[evidenceFilterOf(r)]++;
    return c;
  });

  private readonly langTick = signal(0);

  readonly chips = computed(() => {
    this.langTick();
    const counts = this.counts();
    return EVIDENCE_FILTERS.map((value) => ({ value, label: this.translate.instant(`COMPLIANCE.EVIDENCE_INBOX.${value.toUpperCase()}`, { count: counts[value] }) }));
  });

  readonly columns: TableColumn<EvidenceInboxRow>[] = [
    { key: 'control', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_CONTROL', skeleton: 'lines' },
    { key: 'evidence', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_EVIDENCE', skeleton: 'lines' },
    { key: 'responsible', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_RESPONSIBLE', skeleton: 'lines' },
    { key: 'state', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_STATE', skeleton: 'badge' },
  ];
  readonly rowKey = (row: EvidenceInboxRow): string => row.requirement.id;

  constructor() {
    bindInsight(() => (this.stage() === 'ready' ? { kind: 'count', labelKey: 'COMPLIANCE.BANNER.EVIDENCE', count: this.rows().length } : null));
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.langTick.update((n) => n + 1));
    effect(() => {
      this.serviceId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  /** Dos peticiones en paralelo: los controles del servicio y la evidencia de todos ellos. */
  load(): void {
    const seq = ++this.requestSeq;
    this.stage.set('loading');
    const view = this.view.viewParam();

    forkJoin({ controls: this.controlsApi.listAll(this.serviceId(), view), items: this.api.listByService(this.serviceId(), view) }).subscribe({
      next: ({ controls, items }) => {
        if (seq !== this.requestSeq) return;
        const byControl = new Map<string, EvidenceRequirement[]>();
        for (const item of items) {
          const list = byControl.get(item.control_id);
          if (list) list.push(item);
          else byControl.set(item.control_id, [item]);
        }
        this.controls.set(controls);
        this.evidence.set(byControl);
        this.stage.set('ready');
      },
      error: () => {
        if (seq === this.requestSeq) this.stage.set('error');
      },
    });
  }

  pick(value: string): void {
    this.filter.set(value as EvidenceFilter);
  }

  open(row: EvidenceInboxRow): void {
    this.selected.set(row.control.id);
  }

  /** Una causa del control abierto: se abre en Causas. */
  openCause(id: string): void {
    this.router.navigate(['/', COMPLIANCE_ROUTE, 'causas'], { queryParams: { abrir: id } });
  }

  /** Se subió algo en el panel de un control: se vuelve a pedir solo la evidencia de ese control. */
  reload(controlId: string): void {
    this.api.list(controlId, this.view.viewParam()).subscribe({
      next: (requirements) => this.evidence.update((m) => new Map(m).set(controlId, requirements)),
    });
  }

  responsibleOf(row: EvidenceInboxRow): string {
    const r = row.requirement.responsible;
    if (!r) return this.translate.instant('COMPLIANCE.EVIDENCE.NO_RESPONSIBLE');
    return this.translate.instant('COMPLIANCE.EVIDENCE.RESPONSIBLE', {
      role: this.labels.of('COMPLIANCE.RESPONSIBLE_TYPE', r.type),
      person: r.person_name ?? this.translate.instant('COMPLIANCE.EVIDENCE.NO_PERSON'),
    });
  }

  stateLabel(row: EvidenceInboxRow): string {
    return row.latest ? this.labels.of('COMPLIANCE.EVIDENCE_STATUS', row.latest.evidence_state) : this.translate.instant('COMPLIANCE.EVIDENCE_INBOX.NOT_DELIVERED');
  }

  /** El estado de la última entrega, con el tono de estado del sistema; el texto siempre va junto al punto. */
  stateTone(row: EvidenceInboxRow): StatusTone {
    return evidenceStateTone(row.latest?.evidence_state);
  }

  lastDelivery(row: EvidenceInboxRow): string {
    const s = row.latest;
    if (!s) return '';
    const date = formatLocalDate(s.submitted_at, this.language.current());
    return this.translate.instant('COMPLIANCE.EVIDENCE_INBOX.LAST_DELIVERY', { version: s.version, date });
  }
}
