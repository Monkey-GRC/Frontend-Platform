import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { NavigationHistoryService } from '@core/domain/services/navigation-history.service';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Pagination } from '@shared/presentation/components/pagination/pagination';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { TableFilter } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { Busy } from '@shared/presentation/directives/busy';
import { NOTIFICATION_READ_FILTERS, NotificationItem, NotificationReadFilter } from '@features/notifications/domain/models/notification.models';
import { NotificationService } from '@features/notifications/domain/services/notification.service';
import { NotificationStreamService } from '@features/notifications/domain/services/notification-stream.service';
import { relativeTime } from '@features/notifications/domain/utils/relative-time';
import { NotificationCard } from '@features/notifications/presentation/components/notification-card/notification-card';
import { NotificationCardSkeleton } from '@features/notifications/presentation/components/notification-card/notification-card-skeleton';
import { NotificationDetailPanel } from '@features/notifications/presentation/components/notification-detail/notification-detail';
import { OPEN_PARAM } from '@shared/domain/models/route-links';

type Stage = 'loading' | 'error' | 'ready';

const PAGE_SIZE = 10;
/** Una ráfaga de avisos por el canal en vivo se vuelve una sola lectura de la lista. */
export const LIVE_RELOAD_DELAY_MS = 400;

// El centro de notificaciones (`/notificaciones`; `/avisos` redirige): las notificaciones de los últimos 90 días de la persona, con un buscador a todo el ancho, el filtro de leídos y no leídos y el de tipo; cada aviso es una `app-notification-card` (una columna centrada). Los dos filtros se
// piden al servidor; el buscador y las páginas trabajan sobre lo cargado (la lista no tiene búsqueda de texto en el servidor y son 90 días de una sola persona). El detalle de un
// aviso va en el panel lateral ancho (`?abrir=<id>`): abrirlo lo marca leído y se puede volver a dejar sin leer. Se pone al día solo cuando llega un aviso por el canal en vivo.
@Component({
  selector: 'app-notification-center',
  imports: [
    RouterLink, TranslatePipe, EmptyState, OptionChips, PageHeader, Pagination, SkeletonRegion, TableFilter, TableToolbar, Busy, NotificationCard, NotificationCardSkeleton, NotificationDetailPanel,
  ],
  templateUrl: './notification-center.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenterView {
  private readonly api = inject(NotificationService);
  private readonly stream = inject(NotificationStreamService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly history = inject(NavigationHistoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stage = signal<Stage>('loading');
  private readonly all = signal<NotificationItem[]>([]);
  readonly status = signal<NotificationReadFilter>('all');
  readonly type = signal('');
  private readonly typeOptions = signal<CatalogOption[]>([]);
  readonly marking = signal(false);
  readonly toggling = signal(false);
  private readonly now = signal(Date.now());
  // Cada lectura de la lista entra por aquí: `switchMap` cancela la anterior (y su recorrido de páginas) si llega otra; `true` = en silencio, sin volver al esqueleto.
  private readonly requests = new Subject<boolean>();
  private readonly liveChanges = new Subject<void>();
  private seenChanges = this.stream.changes();
  // El aviso de `?abrir=` que ya se comprobó contra la lista: no se vuelve a pedir ni a avisar por él.
  private checkedId: string | null = null;

  readonly list = new ClientList<NotificationItem>(this.all, (n, q) =>
    includesText(q, n.title, n.service?.name, n.control?.code, n.control?.name, ...(n.control?.requirement_codes ?? []), this.typeLabel(n.type)),
  );

  readonly unread = this.stream.unreadCount;
  /** Cada tarjeta con su etiqueta de tipo y su «hace cuánto», calculados una vez por cambio (no en cada render). */
  readonly cards = computed(() => {
    this.language.current();
    return this.list.rows().map((item) => ({ item, typeLabel: this.typeLabel(item.type), ago: this.ago(item) }));
  });
  readonly selectedTypeLabel = computed(() => {
    const item = this.selected();
    return item ? this.typeLabel(item.type) : '';
  });
  readonly hasFilters = computed(() => this.status() !== 'all' || this.type() !== '' || this.list.searching());

  // El que se abre va en la dirección: se puede compartir y «Atrás» lo cierra.
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  // Lo abierto se recuerda aparte: si un filtro lo saca de la lista (se marcó leído con «No leídos» puesto), el panel no se cierra solo.
  private readonly opened = signal<NotificationItem | null>(null);
  readonly selected = computed(() => {
    const id = this.query().get(OPEN_PARAM);
    if (!id) return null;
    return this.all().find((n) => n.id === id) ?? (this.opened()?.id === id ? this.opened() : null);
  });

  private readonly labels = toSignal(
    this.translate.stream(['NOTIFICATIONS.FILTER.ALL', 'NOTIFICATIONS.FILTER.UNREAD', 'NOTIFICATIONS.FILTER.READ']),
    { initialValue: {} as Record<string, string> },
  );
  readonly statusChips = computed(() =>
    NOTIFICATION_READ_FILTERS.map((value) => ({ value, label: this.labels()[`NOTIFICATIONS.FILTER.${value.toUpperCase()}`] ?? '' })),
  );
  readonly typeFilterOptions = computed(() => this.typeOptions().map((o) => ({ value: o.value, label: o.label })));

  /** Las páginas de tarjetas: de a 10, 25 o 50. */
  readonly pageSizes = [PAGE_SIZE, 25, 50];
  readonly placeholders = [1, 2, 3, 4];

  constructor() {
    this.list.pageSize.set(PAGE_SIZE);
    // Fuera del shell no hay campana que abra el canal en vivo: la página lo abre y lo cierra al salir, solo si lo abrió ella.
    if (this.stream.start()) this.destroyRef.onDestroy(() => this.stream.stop());
    this.api.typeOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (options) => this.typeOptions.set(options), error: () => undefined });
    this.requests
      .pipe(
        switchMap((silent) => {
          this.now.set(Date.now());
          return this.api.listAll({ status: this.status(), type: this.type() || null }).pipe(
            map((items) => ({ items, silent })),
            catchError(() => of({ items: null, silent })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ items, silent }) => {
        if (items) {
          this.all.set(items);
          this.stage.set('ready');
          this.checkOpened(items);
        } else if (!silent || this.stage() === 'loading') {
          this.stage.set('error');
        }
      });
    this.load();
    // Un aviso nuevo, o el contador que cambió en otra pestaña: la lista se pone al día sin volver a la carga, una vez por ráfaga.
    this.liveChanges.pipe(debounceTime(LIVE_RELOAD_DELAY_MS), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(true));
    effect(() => {
      const tick = this.stream.changes();
      untracked(() => {
        if (tick === this.seenChanges) return;
        this.seenChanges = tick;
        this.liveChanges.next();
      });
    });
    // Un enlace a un aviso que no está en lo cargado (llegó hace un momento): se vuelve a leer la lista una vez y, si sigue sin estar, se dice.
    effect(() => {
      const id = this.query().get(OPEN_PARAM);
      const missing = this.stage() === 'ready' && !!id && !this.selected();
      untracked(() => {
        if (!id) this.checkedId = null;
        else if (missing && this.checkedId !== id && !this.filtered()) this.load(true);
      });
    });
  }

  /** «Volver a la aplicación»: a la pantalla de la que vino la persona, o al inicio si entró directo (igual que Ajustes). */
  back(): void {
    void this.router.navigateByUrl(this.history.returnUrl);
  }

  load(silent = false): void {
    if (!silent) this.stage.set('loading');
    this.requests.next(silent);
  }

  private filtered(): boolean {
    return this.status() !== 'all' || this.type() !== '';
  }

  /** La lista llegó: si la dirección trae un aviso que no está (ya pasaron los 90 días o no es de esta persona), se avisa y se cierra el panel en vez de no hacer nada. */
  private checkOpened(items: NotificationItem[]): void {
    const id = this.query().get(OPEN_PARAM);
    if (!id) return;
    this.checkedId = id;
    if (items.some((n) => n.id === id) || this.opened()?.id === id || this.filtered()) return;
    this.toast.showInfo(this.translate.instant('NOTIFICATIONS.CENTER.NOT_AVAILABLE'), this.translate.instant('NOTIFICATIONS.CENTER.NOT_AVAILABLE_BODY'));
    this.closeDetail();
  }

  pickStatus(value: string): void {
    this.status.set(value as NotificationReadFilter);
    this.list.restart();
    this.load();
  }

  pickType(value: string): void {
    this.type.set(value);
    this.list.restart();
    this.load();
  }

  clearFilters(): void {
    this.status.set('all');
    this.type.set('');
    this.list.reset();
    this.load();
  }

  typeLabel(type: string): string {
    return this.typeOptions().find((o) => o.value === type)?.label ?? type;
  }

  ago(item: NotificationItem): string {
    return relativeTime(item.created_at, this.language.current(), this.now());
  }

  open(item: NotificationItem): void {
    this.opened.set(item);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [OPEN_PARAM]: item.id }, queryParamsHandling: 'merge' });
    if (!item.is_read) this.setRead(item, true);
  }

  closeDetail(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [OPEN_PARAM]: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Marcar o desmarcar un aviso: se ve al instante y, si el servidor no lo acepta, vuelve a como estaba. */
  setRead(item: NotificationItem, isRead: boolean): void {
    this.patch(item.id, isRead);
    this.toggling.set(true);
    this.api.setRead(item.id, isRead).subscribe({
      next: () => this.toggling.set(false),
      error: () => {
        this.patch(item.id, !isRead);
        this.toggling.set(false);
      },
    });
  }

  markAll(): void {
    const upTo = this.all().reduce<string | null>((max, n) => (max === null || n.created_at > max ? n.created_at : max), null);
    if (!upTo || this.marking()) return;
    this.marking.set(true);
    this.api.markAllRead(upTo).subscribe({
      next: () => {
        this.marking.set(false);
        this.stream.refresh();
        this.load(true);
      },
      error: () => this.marking.set(false),
    });
  }

  private patch(id: string, isRead: boolean): void {
    const current = this.all().find((n) => n.id === id) ?? (this.opened()?.id === id ? this.opened() : null);
    if (!current || current.is_read === isRead) return;
    this.all.update((list) => list.map((n) => (n.id === id ? { ...n, is_read: isRead } : n)));
    this.opened.update((o) => (o && o.id === id ? { ...o, is_read: isRead } : o));
    this.stream.adjust(isRead ? -1 : 1);
  }
}
