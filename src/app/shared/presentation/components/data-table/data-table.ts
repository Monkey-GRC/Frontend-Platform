import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, TemplateRef, computed, contentChildren, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PageInfo, canGoBack, canGoForward, visibleRange } from '@shared/domain/utils/pagination';
import { EmptyState } from '../empty-state/empty-state';

export interface TableColumn<T> {
  key: string;
  // Clave de traducción del encabezado.
  headerKey: string;
  // Texto de la celda cuando no hay plantilla propia (`<ng-template appCell="key">`).
  value?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  // Clases extra para la celda y el encabezado (por ejemplo, un ancho).
  class?: string;
  // El encabezado se oculta a la vista pero sigue ahí para los lectores de pantalla (columna de acciones).
  srOnlyHeader?: boolean;
}

// Marca la plantilla de una celda: `<ng-template appCell="status" let-row><app-status-badge [status]="row.status" /></ng-template>`.
@Directive({ selector: 'ng-template[appCell]' })
export class TableCell {
  readonly key = input.required<string>({ alias: 'appCell' });
  readonly template = inject(TemplateRef);
}

// Tabla con paginación del servidor (el formato de `page`, `page_size`, `total` y `total_pages` del backend). No pide datos: recibe las filas y
// avisa cuando se cambia de página o de tamaño; quien la usa vuelve a pedir. Con la lista vacía muestra el estado vacío (se puede reemplazar
// proyectando algo con el atributo `tableEmpty`). Los textos son claves de traducción.
//   <app-data-table captionKey="..." [columns]="columns" [rows]="rows()" [rowKey]="byId" [page]="page()" [loading]="loading()"
//     (pageChange)="goTo($event)" (pageSizeChange)="resize($event)">
//     <ng-template appCell="status" let-row><app-status-badge [status]="row.status" /></ng-template>
//   </app-data-table>
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, TranslatePipe, EmptyState],
  templateUrl: './data-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T> {
  // Descripción de la tabla para lectores de pantalla (no se ve).
  readonly captionKey = input.required<string>();
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly rowKey = input.required<(row: T) => string | number>();
  readonly page = input<PageInfo | null>(null);
  readonly pageSizes = input<number[]>([10, 25, 50]);
  readonly loading = input(false);
  // Las filas se pueden activar (clic, Enter) para abrir su detalle.
  readonly clickable = input(false);
  readonly emptyIcon = input('inbox');
  readonly emptyTitleKey = input('COMMON.TABLE.EMPTY_TITLE');
  readonly emptyDescriptionKey = input<string | null>(null);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly rowClick = output<T>();

  private readonly cells = contentChildren(TableCell);

  protected readonly range = computed(() => {
    const page = this.page();
    return page ? visibleRange(page) : null;
  });
  protected readonly hasPrevious = computed(() => {
    const page = this.page();
    return !!page && canGoBack(page);
  });
  protected readonly hasNext = computed(() => {
    const page = this.page();
    return !!page && canGoForward(page);
  });

  protected cellFor(key: string): TemplateRef<unknown> | null {
    return this.cells().find((c) => c.key() === key)?.template ?? null;
  }

  protected align(column: TableColumn<T>): string {
    return column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';
  }

  protected previous(): void {
    const page = this.page();
    if (page && canGoBack(page)) this.pageChange.emit(page.page - 1);
  }

  protected next(): void {
    const page = this.page();
    if (page && canGoForward(page)) this.pageChange.emit(page.page + 1);
  }

  protected resize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected activate(row: T): void {
    if (this.clickable()) this.rowClick.emit(row);
  }
}
