import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { controlLink } from '@shared/domain/models/route-links';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { WorkItem } from '@features/work/domain/models/work.models';
import { WorkService } from '@features/work/domain/services/work.service';

import { timeout } from 'rxjs';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';
const PAGE_SIZE = 25;

// «Mi trabajo» (MD-505, MD-529): por ahora solo «Por aprobar», lo que espera la decisión de quien entra (el responsable y el administrador de la empresa). Cada fila lleva el código del control,
// su título, el servicio y lo que espera (las etiquetas de `pending_decisions` salen del catálogo `work_decision_kind`). Abrir una fila lleva al control, a su pestaña «Aprobación».
@Component({
  selector: 'app-my-work',
  imports: [TranslatePipe, PageHeader, DataTable, TableCell, EmptyState, Tag, Badge, SkeletonRegion],
  templateUrl: './my-work.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyWorkView implements OnInit {
  private readonly api = inject(WorkService);
  private readonly labels = inject(ManagementLabelsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly stage = signal<Stage>('loading');
  readonly items = signal<WorkItem[]>([]);
  readonly page = signal<PageInfo | null>(null);
  /** Cambiar de página o de tamaño con filas ya cargadas: la tabla se atenúa y no admite otro cambio hasta que llegue. */
  readonly refreshing = signal(false);
  private pageNumber = 1;
  private pageSize = PAGE_SIZE;
  private seq = 0;

  readonly columns: TableColumn<WorkItem>[] = [
    { key: 'code', headerKey: 'WORK.REVIEW.COLUMNS.CODE', class: 'w-32', skeleton: 'badge' },
    { key: 'title', headerKey: 'WORK.REVIEW.COLUMNS.CONTROL', skeleton: 'lines' },
    { key: 'service', headerKey: 'WORK.REVIEW.COLUMNS.SERVICE', skeleton: 'text' },
    { key: 'waiting', headerKey: 'WORK.REVIEW.COLUMNS.WAITING', skeleton: 'badges' },
  ];
  readonly rowKey = (i: WorkItem): string => i.client_control_id;
  readonly rowLabel = (i: WorkItem): string => `${i.code} ${i.title}`;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const seq = ++this.seq;
    if (this.items().length === 0) this.stage.set('loading');
    else this.refreshing.set(true);
    this.api.toReview(this.pageNumber, this.pageSize).pipe(timeout(LOAD_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, page }) => {
        if (seq !== this.seq) return;
        this.items.set(items);
        this.page.set(page);
        this.stage.set('ready');
        this.refreshing.set(false);
      },
      error: () => {
        if (seq !== this.seq) return;
        this.refreshing.set(false);
        this.stage.set('error');
      },
    });
  }

  goTo(page: number): void {
    if (this.refreshing()) return;
    this.pageNumber = page;
    this.load();
  }

  resize(size: number): void {
    if (this.refreshing()) return;
    this.pageSize = size;
    this.pageNumber = 1;
    this.load();
  }

  kindLabel(kind: string): string {
    return this.labels.label('work_decision_kind', kind);
  }

  open(item: WorkItem): void {
    const link = controlLink(item.client_control_id, item.service.id, 'approval');
    void this.router.navigate(link.commands, { queryParams: link.queryParams });
  }
}
