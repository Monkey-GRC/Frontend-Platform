import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import type { StatusTone } from '@shared/domain/models/status-tone.model';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { Finding, FindingsSummary, GapPriority } from '@features/compliance/domain/models/finding.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { remediationBlocks } from '@features/compliance/domain/utils/remediation-text';
import { Busy } from '@shared/presentation/directives/busy';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { DataTable, TableCell, TableColumn, TableRowDetail } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';

type Stage = 'closed' | 'loading' | 'ready' | 'error';

// La prioridad es un estado de la brecha (Rod, MD-502): crítica y alta en alerta, media en aviso y baja neutra; siempre con su etiqueta del catálogo `gap_priority`.
// En una brecha exceptuada va neutra: está aceptada y no debe alarmar.
const PRIORITY_TONE: Record<GapPriority, StatusTone> = {
  critical: 'bad',
  high: 'bad',
  medium: 'warn',
  low: 'neutral',
};
const SHOWN_RESOURCES = 5;
const NO_SUMMARY: FindingsSummary = { open_gaps: 0, excepted: 0, observations: 0 };

// D138 · Bajo una prueba técnica: el enlace abre un modal auxiliar sobre el panel del control (patrón 19, Rod 2026-11-27) con una fila por brecha (check y activo) y, al pulsarla,
// la plantilla del libro desplegada debajo (una fila abierta a la vez). Se pide al abrir el modal (no al pintar el control) y se cancela al cerrarlo. Las etiquetas de prioridad
// y de criticidad salen de los catálogos del backend. La guía puede venir traducida por una IA: entonces lo dice; sin traducción, muestra el original en inglés y también lo dice.
@Component({
  selector: 'app-test-findings',
  imports: [NgTemplateOutlet, TranslatePipe, ExpandableText, StatusIndicator, Busy, DetailModal, DataTable, TableCell, TableRowDetail, Tag, EmptyState],
  templateUrl: './test-findings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestFindings {
  private readonly api = inject(FindingService);
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);
  private loadSub?: Subscription;
  private moreSub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  readonly controlId = input.required<string>();
  readonly testId = input.required<string>();
  /** El código y el nombre de la prueba, para la cabecera del modal desde el primer momento; si faltan, los de la respuesta. */
  readonly testCode = input<string | null>(null);
  readonly testName = input<string | null>(null);

  readonly stage = signal<Stage>('closed');
  readonly items = signal<Finding[]>([]);
  readonly total = signal(0);
  readonly measuredAt = signal<string | null>(null);
  readonly control = signal('');
  readonly test = signal('');
  private readonly testDisplayName = signal('');
  readonly summary = signal<FindingsSummary>(NO_SUMMARY);
  /** Ya se cargó una vez: los contadores se quedan junto al enlace aunque se cierre el modal. */
  readonly counted = signal(false);
  /** La fila desplegada (acordeón: abrir una cierra la otra). */
  readonly openRow = signal<string | null>(null);
  readonly headerCode = computed(() => this.testCode() || this.test());
  readonly headerName = computed(() => this.testName() || this.testDisplayName());
  protected readonly columns: TableColumn<Finding>[] = [
    { key: 'priority', headerKey: 'COMPLIANCE.FINDINGS.COL_PRIORITY', class: 'w-36', skeleton: 'badge' },
    { key: 'asset', headerKey: 'COMPLIANCE.FINDINGS.COL_ASSET', class: 'w-56' },
    { key: 'check', headerKey: 'COMPLIANCE.FINDINGS.COL_CHECK', skeleton: 'lines' },
    { key: 'owner', headerKey: 'COMPLIANCE.FINDINGS.COL_OWNER', class: 'w-44' },
    { key: 'due', headerKey: 'COMPLIANCE.FINDINGS.COL_DUE', class: 'w-44' },
  ];
  protected readonly findingKey = (f: Finding) => f.id;
  protected readonly findingLabel = (f: Finding) => `${f.asset.name}: ${f.title}`;
  private readonly priorities = signal<CatalogOption[]>([]);
  private readonly criticalities = signal<CatalogOption[]>([]);
  readonly loadingMore = signal(false);
  readonly moreFailed = signal(false);
  private page = 1;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly hasMore = computed(() => this.items().length < this.total());
  protected readonly SHOWN = SHOWN_RESOURCES;
  protected readonly blocks = remediationBlocks;

  /** Abre el modal y pide la primera página. */
  openModal(): void {
    if (this.stage() === 'closed') this.load();
  }

  /** Cierra el modal y cancela lo que estuviera en curso. */
  closeModal(): void {
    this.cancel();
    this.openRow.set(null);
    this.stage.set('closed');
  }

  toggleRow(f: Finding): void {
    this.openRow.update((id) => (id === f.id ? null : f.id));
  }

  private cancel(): void {
    this.loadSub?.unsubscribe();
    this.moreSub?.unsubscribe();
    this.loadSub = undefined;
    this.moreSub = undefined;
    this.loadingMore.set(false);
    this.moreFailed.set(false);
  }

  load(): void {
    this.cancel();
    this.stage.set('loading');
    this.openRow.set(null);
    this.page = 1;
    this.loadSub = forkJoin({
      page: this.api.list(this.controlId(), this.testId(), 1),
      priorities: this.catalogs.options('gap_priority').pipe(catchError(() => of([] as CatalogOption[]))),
      criticalities: this.catalogs.options('asset_criticality').pipe(catchError(() => of([] as CatalogOption[]))),
    }).subscribe({
      next: ({ page: r, priorities, criticalities }) => {
        this.priorities.set(priorities);
        this.criticalities.set(criticalities);
        this.items.set(r.items);
        this.total.set(r.total);
        this.summary.set(r.summary);
        this.control.set(r.control.code);
        this.test.set(r.test.code);
        this.testDisplayName.set(r.test.display_name);
        this.counted.set(true);
        this.measuredAt.set(r.measured_at);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  more(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.moreSub = this.api.list(this.controlId(), this.testId(), this.page + 1).subscribe({
      next: (r) => {
        this.page += 1;
        this.items.update((list) => [...list, ...r.items]);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.moreFailed.set(true);
      },
    });
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  expand(id: string): void {
    this.expanded.update((s) => new Set(s).add(id));
  }

  shown(f: Finding) {
    return this.isExpanded(f.id) ? f.resources : f.resources.slice(0, SHOWN_RESOURCES);
  }

  /** El tono del chip de prioridad: neutro en una brecha exceptuada (está aceptada y no debe alarmar). */
  priorityTone(f: Finding): StatusTone {
    return f.kind === 'excepted' || !f.priority ? 'neutral' : PRIORITY_TONE[f.priority];
  }

  /** Etiqueta del catálogo; mientras no llega (o si el valor es nuevo) se muestra el valor tal cual. */
  priorityLabel(value: string): string {
    return this.priorities().find((o) => o.value === value)?.label ?? value;
  }

  criticalityLabel(value: string): string {
    return this.criticalities().find((o) => o.value === value)?.label ?? value;
  }

  ownerName(f: Finding): string {
    return f.owner ? `${f.owner.name} ${f.owner.last_name}`.trim() : '';
  }

  day(value: string): string {
    return formatLocalDate(value, this.language.current(), { calendar: true }) || value;
  }

  instant(value: string): string {
    return formatLocalDate(value, this.language.current()) || value;
  }
}
