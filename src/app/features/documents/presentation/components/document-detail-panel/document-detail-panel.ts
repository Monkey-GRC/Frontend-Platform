import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { formatBytes } from '@shared/domain/utils/file-validation';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { Badge } from '@shared/presentation/components/badge/badge';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TabItem } from '@shared/presentation/components/tabs/tabs';
import { Tag } from '@shared/presentation/components/tag/tag';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { Busy } from '@shared/presentation/directives/busy';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { DocumentAssignee, DocumentDetail, DocumentVersion } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { downloadFromUrl, isHttpUrl, myStatusTone, outstanding } from '@features/documents/domain/utils/document-status';
import { AssignPeopleForm } from '../assign-people-form/assign-people-form';
import { PublishVersionForm } from '../publish-version-form/publish-version-form';

type Stage = 'loading' | 'error' | 'ready';
type Tab = 'summary' | 'versions' | 'people';
const TABS: readonly Tab[] = ['summary', 'versions', 'people'];

// El detalle de un documento de la empresa, en el panel lateral (`app-detail-modal` variante `drawer-narrow`, MD-499: su contenido es corto): resumen (qué es, qué contenido mínimo pide, su versión vigente y cuántas
// personas la aceptaron), versiones (con quién aprobó cada una y cuándo) y personas (a quién se le asignó y en qué punto está cada una). El `admin_empresa` publica la versión vigente y asigna
// personas desde el pie; el `auditor` lo lee sin acciones (D133, D136). Los conteos van siempre con su total, nunca un porcentaje solo.
@Component({
  selector: 'app-document-detail-panel',
  imports: [TranslatePipe, DetailModal, DetailSection, FormModal, DataTable, TableCell, Tag, Badge, StatusIndicator, PersonCell, SearchField, Skeleton, SkeletonRegion, Busy, LocalDatePipe, PublishVersionForm, AssignPeopleForm],
  templateUrl: './document-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailPanel {
  private readonly api = inject(DocumentService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly myStatusTone = myStatusTone;
  protected readonly outstanding = outstanding;
  protected readonly formatBytes = formatBytes;

  readonly documentId = input.required<string>();
  /** Solo el administrador publica versiones y asigna personas; el auditor lo lee. */
  readonly canManage = input(false);
  /** Se cerró el panel. */
  readonly closed = output<void>();
  /** Se publicó una versión o se asignó a alguien: la lista se vuelve a pedir. */
  readonly changed = output<void>();

  readonly stage = signal<Stage>('loading');
  readonly detail = signal<DocumentDetail | null>(null);
  readonly tab = signal<Tab>('summary');
  readonly error = signal<string | null>(null);
  readonly downloadingId = signal<string | null>(null);

  readonly publishOpen = signal(false);
  readonly assignOpen = signal(false);
  private readonly publishForm = viewChild(PublishVersionForm);
  private readonly assignForm = viewChild(AssignPeopleForm);

  /** Los tipos y las reglas de aceptación con su etiqueta del catálogo; si no llegan, el panel sigue mostrando lo demás. */
  private readonly types = signal<CatalogOption[]>([]);
  private readonly acceptances = signal<CatalogOption[]>([]);

  readonly ready = computed(() => (this.stage() === 'ready' ? this.detail() : null));
  readonly current = computed(() => this.ready()?.versions.find((v) => v.status === 'current') ?? null);
  readonly assignees = computed(() => this.ready()?.assignees ?? []);
  /** Quién ya lo tiene asignado: el formulario de asignar no lo vuelve a ofrecer. */
  readonly assignedIds = computed(() => this.assignees().map((a) => a.user.id));
  readonly versions = computed(() => this.ready()?.versions ?? []);
  readonly tabs = computed<TabItem[]>(() => [
    { id: 'summary', labelKey: 'DOCUMENTS.DETAIL.TABS.SUMMARY' },
    { id: 'versions', labelKey: 'DOCUMENTS.DETAIL.TABS.VERSIONS', count: this.versions().length },
    { id: 'people', labelKey: 'DOCUMENTS.DETAIL.TABS.PEOPLE', count: this.assignees().length },
  ]);
  readonly typeLabel = computed(() => this.types().find((t) => t.value === this.ready()?.type)?.label ?? '');
  readonly acceptanceLabel = computed(() => this.acceptances().find((t) => t.value === this.ready()?.acceptance)?.label ?? '');
  /** Solo se asigna lo que ya tiene una versión vigente (`409 DOCUMENT_NOT_PUBLISHED`). */
  readonly canAssign = computed(() => !!this.ready()?.current_version);

  // Las listas largas de un detalle: tabla con buscador y páginas (MD-499).
  readonly peopleList = new ClientList<DocumentAssignee>(this.assignees, (a, q) => includesText(q, a.user.name, a.user.last_name));
  readonly versionList = new ClientList<DocumentVersion>(this.versions, (v, q) => includesText(q, v.number, v.file_name));

  readonly versionColumns: TableColumn<DocumentVersion>[] = [
    { key: 'version', headerKey: 'DOCUMENTS.DETAIL.VERSIONS.COLUMNS.VERSION', skeleton: 'badges' },
    { key: 'approval', headerKey: 'DOCUMENTS.DETAIL.VERSIONS.COLUMNS.APPROVAL', skeleton: 'lines' },
    { key: 'file', headerKey: 'DOCUMENTS.DETAIL.VERSIONS.COLUMNS.FILE', skeleton: 'lines' },
    { key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right', srOnlyHeader: true, skeleton: 'actions' },
  ];
  readonly peopleColumns: TableColumn<DocumentAssignee>[] = [
    { key: 'person', headerKey: 'DOCUMENTS.DETAIL.PEOPLE.COLUMNS.PERSON', skeleton: 'person' },
    { key: 'status', headerKey: 'DOCUMENTS.DETAIL.PEOPLE.COLUMNS.STATUS', skeleton: 'badge' },
    { key: 'detail', headerKey: 'DOCUMENTS.DETAIL.PEOPLE.COLUMNS.DETAIL', skeleton: 'lines' },
  ];
  readonly versionKey = (v: DocumentVersion): string => v.id;
  readonly assigneeKey = (a: DocumentAssignee): string => a.user.id;
  readonly assigneeLabel = (a: DocumentAssignee): string => this.personName(a.user);

  private loadSeq = 0;

  constructor() {
    effect(() => {
      this.documentId();
      untracked(() => {
        this.tab.set('summary');
        this.peopleList.reset();
        this.versionList.reset();
        this.error.set(null);
        this.load();
      });
    });
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir.
    effect(() => {
      this.language.current();
      untracked(() => {
        this.api.catalog('document_type').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.types.set(o), error: () => this.types.set([]) });
        this.api.catalog('document_acceptance').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.acceptances.set(o), error: () => this.acceptances.set([]) });
      });
    });
  }

  load(): void {
    const seq = ++this.loadSeq;
    this.stage.set('loading');
    this.api.get(this.documentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => {
        if (seq !== this.loadSeq) return;
        this.detail.set(detail);
        this.stage.set('ready');
      },
      error: () => seq === this.loadSeq && this.stage.set('error'),
    });
  }

  /** Vuelve a pedir el detalle sin tapar lo que se está leyendo (después de publicar o asignar). */
  private refresh(): void {
    const seq = ++this.loadSeq;
    this.api.get(this.documentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => seq === this.loadSeq && this.detail.set(detail),
      error: () => undefined,
    });
  }

  selectTab(id: string): void {
    const tab = TABS.find((t) => t === id);
    if (tab) this.tab.set(tab);
  }

  personName(p: { name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || '—';
  }

  // ─── acciones del administrador ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  openPublish(): void {
    this.error.set(null);
    this.publishOpen.set(true);
  }

  openAssign(): void {
    this.error.set(null);
    this.assignOpen.set(true);
  }

  readonly publishDirty = computed(() => this.publishForm()?.dirty() ?? false);
  readonly publishSaving = computed(() => this.publishForm()?.saving() ?? false);
  readonly publishCanSubmit = computed(() => this.publishForm()?.canSubmit() ?? false);
  readonly assignDirty = computed(() => this.assignForm()?.dirty() ?? false);
  readonly assignSaving = computed(() => this.assignForm()?.saving() ?? false);
  readonly assignCanSubmit = computed(() => this.assignForm()?.canSubmit() ?? false);

  onPublished(version: DocumentVersion): void {
    this.publishOpen.set(false);
    this.toast.showSuccess(this.translate.instant('DOCUMENTS.PUBLISH.DONE', { number: version.number }));
    this.refresh();
    this.changed.emit();
  }

  onAssigned(added: number): void {
    this.assignOpen.set(false);
    this.toast.showSuccess(this.translate.instant('DOCUMENTS.ASSIGN.DONE', { count: added }));
    this.refresh();
    this.changed.emit();
  }

  /** Baja el archivo de una versión con un enlace firmado de 5 minutos. */
  download(version: DocumentVersion): void {
    if (this.downloadingId()) return;
    this.downloadingId.set(version.id);
    this.error.set(null);
    this.api.fileLink(this.documentId(), version.id, 'attachment').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (link) => {
        this.downloadingId.set(null);
        if (isHttpUrl(link.url)) downloadFromUrl(link.url, link.file_name);
        else this.error.set(this.translate.instant('DOCUMENTS.DETAIL.DOWNLOAD_ERROR'));
      },
      error: (e: unknown) => {
        this.downloadingId.set(null);
        this.error.set(apiErrorMessage(e, this.translate.instant('DOCUMENTS.DETAIL.DOWNLOAD_ERROR')));
      },
    });
  }
}
