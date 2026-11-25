import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Tag } from '@shared/presentation/components/tag/tag';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { MyDocument } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { myStatusTone } from '@features/documents/domain/utils/document-status';

type Stage = 'loading' | 'error' | 'ready';

// «Mis documentos» (D133, D136, D152, MD-503): lo que la empresa le asignó a esta persona para leer y aceptar. Es la entrada del colaborador y también la tiene el administrador, el responsable y el delegado.
// Cada fila lleva el código del documento, su versión vigente y el estado de la persona con su plazo; el estado nunca va sin su fecha. La lista llega entera (unas decenas de documentos), así que el
// buscador y los filtros trabajan sobre ella. Leer un documento es navegar: el nombre es un enlace a `/mis-documentos/:id`.
@Component({
  selector: 'app-my-documents',
  imports: [TranslatePipe, RouterLink, PageHeader, DataTable, TableCell, TableToolbar, TableFilter, StatusIndicator, Tag, EmptyState, LocalDatePipe],
  templateUrl: './my-documents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDocumentsView implements OnInit {
  private readonly api = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly myStatusTone = myStatusTone;

  readonly stage = signal<Stage>('loading');
  readonly items = signal<MyDocument[]>([]);
  /** Un valor de `my_document_status`, o vacío (sin filtro). */
  readonly statusFilter = signal('');
  /** Los tipos de documento con su etiqueta del catálogo; si no llegan, la fila sigue mostrando el código y el nombre. */
  private readonly types = signal<CatalogOption[]>([]);
  /** Los estados del filtro con su etiqueta, del catálogo `my_document_status` (ninguna lista escrita a mano); si no llegan, el filtro queda sin opciones. */
  private readonly statuses = signal<CatalogOption[]>([]);

  readonly list = new ClientList<MyDocument>(this.items, (d, q) => (!this.statusFilter() || d.status === this.statusFilter()) && includesText(q, d.document.code, d.document.name));
  readonly hasFilters = computed(() => this.list.searching() || !!this.statusFilter());
  readonly statusOptions = computed<TableFilterOption[]>(() => this.statuses().map((s) => ({ value: s.value, label: s.label })));

  readonly columns: TableColumn<MyDocument>[] = [
    { key: 'code', headerKey: 'DOCUMENTS.MINE.COLUMNS.CODE', skeleton: 'badge', class: 'w-32' },
    { key: 'document', headerKey: 'DOCUMENTS.MINE.COLUMNS.DOCUMENT', skeleton: 'lines' },
    { key: 'version', headerKey: 'DOCUMENTS.MINE.COLUMNS.VERSION', skeleton: 'lines' },
    { key: 'status', headerKey: 'DOCUMENTS.MINE.COLUMNS.STATUS', skeleton: 'lines' },
  ];
  readonly rowKey = (d: MyDocument): string => d.document.id;
  readonly rowLabel = (d: MyDocument): string => `${d.document.code} ${d.document.name}`;

  ngOnInit(): void {
    this.load();
    this.api.catalog('document_type').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.types.set(o), error: () => this.types.set([]) });
    this.api.catalog('my_document_status').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.statuses.set(o), error: () => this.statuses.set([]) });
  }

  load(): void {
    this.stage.set('loading');
    this.api.mine().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.items.set(items);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  setStatus(value: string): void {
    this.statusFilter.set(this.statuses().some((s) => s.value === value) ? value : '');
    this.list.restart();
  }

  clearFilters(): void {
    this.statusFilter.set('');
    this.list.reset();
  }

  typeLabel(row: MyDocument): string {
    return this.types().find((t) => t.value === row.document.type)?.label ?? '';
  }

  read(row: MyDocument): void {
    void this.router.navigate(['/mis-documentos', row.document.id]);
  }
}
