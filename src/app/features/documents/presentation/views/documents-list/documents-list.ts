import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, Subscription, debounceTime, filter } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { Badge } from '@shared/presentation/components/badge/badge';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Tag } from '@shared/presentation/components/tag/tag';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { DocumentListItem } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { outstanding } from '@features/documents/domain/utils/document-status';
import { DocumentDetailPanel } from '../../components/document-detail-panel/document-detail-panel';
import { OPEN_PARAM } from '@shared/domain/models/route-links';

type Stage = 'loading' | 'error' | 'ready';
type Publication = '' | 'published' | 'unpublished';

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

// «Documentos» de la empresa (D133, D136, D152, MD-503): la lista de los documentos que le tocan por los marcos que contrató, con su código siempre visible, su versión vigente y cuántas personas
// la aceptaron. La ven el administrador (que publica y asigna) y el auditor (solo lectura). Es una tabla con el buscador arriba a todo el ancho y filtros, y la pide al servidor página a página
// (`q`, `type`, `has_current_version`). La fila abre el detalle en el panel lateral ancho; el documento abierto va en la dirección (`?abrir=<id>`): se puede compartir y «Atrás» lo cierra.
@Component({
  selector: 'app-documents-list',
  imports: [TranslatePipe, PageHeader, DataTable, TableCell, TableToolbar, TableFilter, Tag, Badge, StatusIndicator, EmptyState, LocalDatePipe, DocumentDetailPanel],
  templateUrl: './documents-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsListView {
  private readonly api = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly outstanding = outstanding;

  /** Solo el administrador publica y asigna (la API responde 403 al resto); el auditor lee. */
  readonly canManage = computed(() => isCompanyAdmin(this.session.user()?.role));

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly selected = computed(() => this.query().get(OPEN_PARAM));

  readonly stage = signal<Stage>('loading');
  readonly rows = signal<DocumentListItem[]>([]);
  readonly page = signal<PageInfo | null>(null);
  readonly loadingPage = signal(false);

  readonly search = signal('');
  readonly typeFilter = signal('');
  readonly publication = signal<Publication>('');
  private readonly pageNumber = signal(1);
  private readonly pageSize = signal(PAGE_SIZE);
  private readonly searchInput = new Subject<string>();
  // Una petición más nueva cancela la que sigue en vuelo (cambios rápidos de filtro o de página): su respuesta ya no importa.
  private inflight: Subscription | null = null;
  // Lo último que se le pidió al servidor como búsqueda: buscar lo mismo otra vez después de limpiar los filtros sí vuelve a filtrar.
  private lastQuery = '';

  readonly hasFilters = computed(() => !!(this.search().trim() || this.typeFilter() || this.publication()));

  // Los tipos salen del catálogo del backend (con su etiqueta en el idioma de la sesión): aquí no hay una lista escrita a mano.
  private readonly types = signal<CatalogOption[]>([]);
  readonly typeOptions = computed<TableFilterOption[]>(() => this.types().map((t) => ({ value: t.value, label: t.label })));
  readonly publicationOptions: TableFilterOption[] = [
    { value: 'published', labelKey: 'DOCUMENTS.LIST.PUBLISHED' },
    { value: 'unpublished', labelKey: 'DOCUMENTS.LIST.UNPUBLISHED' },
  ];

  readonly columns: TableColumn<DocumentListItem>[] = [
    { key: 'code', headerKey: 'DOCUMENTS.LIST.COLUMNS.CODE', skeleton: 'badge', class: 'w-32' },
    { key: 'name', headerKey: 'DOCUMENTS.LIST.COLUMNS.NAME', skeleton: 'lines' },
    { key: 'version', headerKey: 'DOCUMENTS.LIST.COLUMNS.VERSION', skeleton: 'lines' },
    { key: 'acceptance', headerKey: 'DOCUMENTS.LIST.COLUMNS.ACCEPTANCE', skeleton: 'lines' },
  ];
  readonly rowKey = (d: DocumentListItem): string => d.id;
  readonly rowLabel = (d: DocumentListItem): string => `${d.code} ${d.name}`;

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin perder los filtros.
    effect(() => {
      this.language.current();
      untracked(() => this.api.catalog('document_type').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.types.set(o), error: () => this.types.set([]) }));
    });
    // El servidor se pregunta cuando se deja de escribir, no en cada letra.
    this.searchInput.pipe(debounceTime(SEARCH_DELAY_MS), filter((value) => value !== this.lastQuery), takeUntilDestroyed()).subscribe(() => this.restart());
    this.destroyRef.onDestroy(() => this.inflight?.unsubscribe());
    this.load();
  }

  load(): void {
    this.inflight?.unsubscribe();
    const first = this.stage() !== 'ready';
    if (first) this.stage.set('loading');
    else this.loadingPage.set(true);
    const published = this.publication();
    this.lastQuery = this.search().trim();
    this.inflight = this.api
      .list({ page: this.pageNumber(), pageSize: this.pageSize(), q: this.search(), type: this.typeFilter() || null, hasCurrentVersion: published === '' ? null : published === 'published' })
      .subscribe({
        next: ({ items, page }) => {
          this.rows.set(items);
          this.page.set(page);
          this.loadingPage.set(false);
          this.stage.set('ready');
        },
        error: () => {
          this.loadingPage.set(false);
          this.stage.set('error');
        },
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchInput.next(value.trim());
  }

  setType(value: string): void {
    this.typeFilter.set(this.types().find((t) => t.value === value)?.value ?? '');
    this.restart();
  }

  setPublication(value: string): void {
    this.publication.set(value === 'published' || value === 'unpublished' ? value : '');
    this.restart();
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set('');
    this.publication.set('');
    this.restart();
  }

  goTo(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  resize(size: number): void {
    this.pageSize.set(size);
    this.restart();
  }

  private restart(): void {
    this.pageNumber.set(1);
    this.load();
  }

  typeLabel(d: DocumentListItem): string {
    return this.types().find((t) => t.value === d.type)?.label ?? '';
  }

  open(row: DocumentListItem): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [OPEN_PARAM]: row.id }, queryParamsHandling: 'merge' });
  }

  closeDetail(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [OPEN_PARAM]: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
