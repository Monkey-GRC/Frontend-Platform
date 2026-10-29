import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, from, map, mergeMap, of, switchMap, tap, toArray } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { ControlListItem, controlCode } from '../../../domain/models/control.models';
import {
  EVIDENCE_FILTERS,
  EvidenceFilter,
  EvidenceInboxRow,
  EvidenceRequirement,
  buildInboxRows,
  evidenceFilterOf,
} from '../../../domain/models/evidence.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { ControlService } from '../../../domain/services/control.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { EvidenceService } from '../../../domain/services/evidence.service';
import { ControlDetailPanel } from '../../components/control-detail-panel/control-detail-panel';

type Stage = 'loading' | 'error' | 'ready';

// Cuántos controles se consultan a la vez. El backend no tiene un endpoint de evidencias por servicio (se pidió en PEDIDO-A-HECTOR.md): se pide la
// lista de controles y, por cada uno, `GET /controls/{id}/evidence`. Con ~90 controles son ~90 peticiones pequeñas, de a pocas.
const CONCURRENCY = 6;

// La pestaña «Evidencias» de un servicio (MD-129): todo lo que los controles piden que se aporte, con su responsable y el estado de la última entrega,
// para ver de un vistazo qué falta. Subir y descargar se hace en el panel del control (se abre con un clic en la fila), con el mismo componente de evidencia
// del control. La bandeja solo muestra (D96): no hay botones de aprobar ni rechazar aquí; el estado lo calcula el servidor a partir de la revisión del administrador de la empresa.
// Hoy lo ve el administrador de la empresa; el detalle por rol espera a los permisos por pantalla (P3).
@Component({
  selector: 'app-evidence-inbox',
  imports: [TranslatePipe, DataTable, TableCell, OptionChips, LoadingSpinner, ControlDetailPanel],
  templateUrl: './evidence-inbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidenceInboxView {
  private readonly route = inject(ActivatedRoute);
  private readonly controlsApi = inject(ControlService);
  private readonly api = inject(EvidenceService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // Hija de `services/:id/cumplimiento`: el id del servicio está en la ruta del padre.
  private readonly params = toSignal(this.route.parent!.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

  readonly stage = signal<Stage>('loading');
  readonly progress = signal({ done: 0, total: 0 });
  /** Controles cuya evidencia no se pudo cargar: la lista puede estar incompleta, y se avisa. */
  readonly failed = signal(0);
  readonly selected = signal<string | null>(null);
  readonly filter = signal<EvidenceFilter>('all');

  private readonly controls = signal<ControlListItem[]>([]);
  private readonly evidence = signal<ReadonlyMap<string, EvidenceRequirement[]>>(new Map());
  private requestSeq = 0;

  readonly rows = computed(() => buildInboxRows(this.controls().map((c) => ({ id: c.id, name: c.name, code: controlCode(c) })), this.evidence()));
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
    { key: 'control', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_CONTROL' },
    { key: 'evidence', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_EVIDENCE' },
    { key: 'responsible', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_RESPONSIBLE' },
    { key: 'state', headerKey: 'COMPLIANCE.EVIDENCE_INBOX.COLUMN_STATE' },
  ];
  readonly rowKey = (row: EvidenceInboxRow): string => row.requirement.id;

  constructor() {
    this.translate.onLangChange.subscribe(() => this.langTick.update((n) => n + 1));
    effect(() => {
      this.serviceId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    const seq = ++this.requestSeq;
    this.stage.set('loading');
    this.failed.set(0);
    this.progress.set({ done: 0, total: 0 });
    const view = this.view.viewParam();

    this.controlsApi
      .listAll(this.serviceId(), view)
      .pipe(
        tap((controls) => {
          if (seq !== this.requestSeq) return;
          this.controls.set(controls);
          this.progress.set({ done: 0, total: controls.length });
        }),
        switchMap((controls) =>
          from(controls).pipe(
            mergeMap(
              (c) =>
                this.api.list(c.id, view).pipe(
                  map((requirements) => ({ id: c.id, requirements, ok: true })),
                  catchError(() => of({ id: c.id, requirements: [] as EvidenceRequirement[], ok: false })),
                ),
              CONCURRENCY,
            ),
            tap(() => seq === this.requestSeq && this.progress.update((p) => ({ ...p, done: p.done + 1 }))),
            toArray(),
          ),
        ),
      )
      .subscribe({
        next: (results) => {
          if (seq !== this.requestSeq) return;
          this.evidence.set(new Map(results.map((r) => [r.id, r.requirements])));
          this.failed.set(results.filter((r) => !r.ok).length);
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

  stateClass(row: EvidenceInboxRow): string {
    const state = row.latest?.evidence_state;
    if (state === 'compliant') return 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300';
    if (state === 'non_compliant' || state === 'expired') return 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-300';
    if (!state) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    return 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25 dark:bg-amber-900/30 dark:text-amber-300';
  }

  lastDelivery(row: EvidenceInboxRow): string {
    const s = row.latest;
    if (!s) return '';
    const date = new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium' }).format(new Date(s.submitted_at));
    return this.translate.instant('COMPLIANCE.EVIDENCE_INBOX.LAST_DELIVERY', { version: s.version, date });
  }
}
