import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { CountBadge } from '@shared/presentation/components/count-badge/count-badge';
import { Switch } from '@shared/presentation/components/switch/switch';
import { NotificationItem } from '@features/notifications/domain/models/notification.models';
import { NotificationService } from '@features/notifications/domain/services/notification.service';
import { NotificationStreamService } from '@features/notifications/domain/services/notification-stream.service';
import { NotificationDetailPanel } from '@features/notifications/presentation/components/notification-detail/notification-detail';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { groupByRecency } from '@features/notifications/domain/utils/notification-panel';
import { relativeTime } from '@features/notifications/domain/utils/relative-time';
import { NotificationCard } from '@features/notifications/presentation/components/notification-card/notification-card';
import { NotificationCardSkeleton } from '@features/notifications/presentation/components/notification-card/notification-card-skeleton';

type Stage = 'loading' | 'ready' | 'error';

/** Cuántos avisos trae el panel (con desplazamiento interno); el resto está en el centro de avisos. */
export const PANEL_SIZE = 20;
/** Una ráfaga de avisos por el canal en vivo se vuelve una sola lectura del panel. */
export const LIVE_RELOAD_DELAY_MS = 400;

// La campana del encabezado (para todos los roles con sesión): el número de avisos sin leer, siempre al día por el canal en vivo, y al abrirla un panel con los últimos.
// Cada aviso es un enlace a su destino y se marca leído al abrirlo. Abrirla no marca nada: «Marcar todos como leídos» está en el menú de acciones. Al aparecer abre el canal
// y al desaparecer (cerrar sesión, salir del shell) lo cierra. Se cierra al elegir algo, al hacer clic fuera y con Escape (si el menú está abierto, Escape cierra solo el menú).
// Cabecera al estilo del panel de Jira (decisión de Rod): el título, «Mostrar solo las no leídas» (`status=unread`), el enlace al centro de avisos y el menú de acciones;
// los avisos, agrupados en «Más recientes» y «Anteriores» (con su contador), cada uno una `app-notification-card`, y al pie «Ver todas las notificaciones».
@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, TranslatePipe, Skeleton, SkeletonRegion, CountBadge, Switch, NotificationCard, NotificationCardSkeleton, NotificationDetailPanel],
  templateUrl: './notification-bell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'onEscape()' },
})
export class NotificationBell {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(NotificationService);
  private readonly stream = inject(NotificationStreamService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuTrigger = viewChild<ElementRef<HTMLButtonElement>>('menuTrigger');
  private readonly menuFirst = viewChild<ElementRef<HTMLButtonElement>>('menuFirst');

  readonly open = signal(false);
  /** «Mostrar solo las no leídas»: el panel pide `status=unread`. */
  readonly unreadOnly = signal(false);
  readonly menuOpen = signal(false);
  /** El aviso abierto en el panel de detalle: va encima de la página, fuera del desplegable (que se cierra al abrirlo), sin navegar. */
  readonly detail = signal<NotificationItem | null>(null);
  readonly detailWorking = signal(false);
  private readonly typeOptions = signal<CatalogOption[]>([]);
  private typesLoaded = false;
  readonly detailTypeLabel = computed(() => {
    const type = this.detail()?.type;
    return this.typeOptions().find((o) => o.value === type)?.label ?? null;
  });
  readonly stage = signal<Stage>('loading');
  readonly items = signal<NotificationItem[]>([]);
  readonly marking = signal(false);
  readonly placeholders = [1, 2, 3, 4];
  private readonly now = signal(Date.now());
  readonly groups = computed(() => groupByRecency(this.items(), this.now()));
  // Cada lectura del panel entra por aquí: `switchMap` cancela la anterior si llega otra.
  private readonly requests = new Subject<void>();
  private readonly liveChanges = new Subject<void>();
  private seenChanges = this.stream.changes();

  readonly count = this.stream.unreadCount;
  readonly labelKey = computed(() => {
    const count = this.count();
    return count === 0 ? 'NOTIFICATIONS.BELL.LABEL_NONE' : count === 1 ? 'NOTIFICATIONS.BELL.LABEL_ONE' : 'NOTIFICATIONS.BELL.LABEL_MANY';
  });

  constructor() {
    this.stream.start();
    this.destroyRef.onDestroy(() => this.stream.stop());
    this.requests
      .pipe(
        switchMap(() => this.api.list({ page: 1, pageSize: PANEL_SIZE, status: this.unreadOnly() ? 'unread' : 'all' }).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        if (page) {
          this.items.set(page.items);
          this.stage.set('ready');
        } else {
          this.stage.set('error');
        }
      });
    // Llegó un aviso (o cambió el contador desde otra pestaña) con el panel abierto: se pone al día sin mostrar la carga otra vez, una vez por ráfaga.
    this.liveChanges.pipe(debounceTime(LIVE_RELOAD_DELAY_MS), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.open()) this.load();
    });
    // «Atrás» del navegador (o cualquier navegación) con el detalle abierto: se cierra, no se queda sobre la página nueva.
    effect((onCleanup) => {
      if (!this.detail()) return;
      const sub = this.router.events.subscribe((event) => {
        if (event instanceof NavigationStart) this.detail.set(null);
      });
      onCleanup(() => sub.unsubscribe());
    });
    effect(() => {
      const tick = this.stream.changes();
      untracked(() => {
        if (tick === this.seenChanges) return;
        this.seenChanges = tick;
        this.liveChanges.next();
      });
    });
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.now.set(Date.now());
    this.open.set(true);
    this.load();
  }

  close(): void {
    this.menuOpen.set(false);
    this.open.set(false);
  }

  onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.close();
  }

  /** Cambia el filtro y vuelve a pedir la lista (con su esqueleto: es otra lista). */
  setUnreadOnly(value: boolean): void {
    if (value === this.unreadOnly()) return;
    this.unreadOnly.set(value);
    this.items.set([]);
    this.load();
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    afterNextRender(() => this.menuFirst()?.nativeElement.focus(), { injector: this.injector });
  }

  closeMenu(): void {
    this.menuOpen.set(false);
    this.menuTrigger()?.nativeElement.focus();
  }

  markAllFromMenu(): void {
    this.closeMenu();
    this.markAll();
  }

  onDocumentClick(event: Event): void {
    const target = event.target as Element | null;
    if (this.open() && !this.host.nativeElement.contains(target)) {
      this.close();
      return;
    }
    // Un clic dentro del panel pero fuera del menú de acciones cierra solo el menú.
    if (this.menuOpen() && !target?.closest('[data-bell-menu]')) this.menuOpen.set(false);
  }

  load(): void {
    if (this.items().length === 0) this.stage.set('loading');
    this.requests.next();
  }

  ago(item: NotificationItem): string {
    return relativeTime(item.created_at, this.language.current(), this.now());
  }

  // Marcar es una petición corta y finita: no se cancela si la campana desaparece a la mitad (se perdería la marca).
  /** «Ver detalles» o la tarjeta: abre el detalle del aviso encima de la página (sin navegar), cierra el desplegable y lo marca leído (sin esperar al servidor; si falla, vuelve a no leído). */
  select(item: NotificationItem): void {
    this.close();
    this.detail.set(item);
    this.loadTypes();
    if (item.is_read) return;
    this.patch(item.id, true);
    this.api.setRead(item.id, true).subscribe({ error: () => this.patch(item.id, false) });
  }

  /** Cierra el detalle y devuelve el foco a la campana (la tarjeta que lo abrió ya no existe: el desplegable se cerró). */
  closeDetail(): void {
    this.detail.set(null);
    afterNextRender(() => this.trigger()?.nativeElement.focus(), { injector: this.injector });
  }

  setRead(item: NotificationItem, isRead: boolean): void {
    this.patch(item.id, isRead);
    this.detailWorking.set(true);
    this.api.setRead(item.id, isRead).subscribe({
      next: () => this.detailWorking.set(false),
      error: () => {
        this.patch(item.id, !isRead);
        this.detailWorking.set(false);
      },
    });
  }

  /** Se siguió una acción del detalle hacia su destino: queda leído y el detalle se cierra. */
  followed(item: NotificationItem): void {
    if (!item.is_read) this.setRead(item, true);
    this.detail.set(null);
  }

  private loadTypes(): void {
    if (this.typesLoaded) return;
    this.typesLoaded = true;
    this.api.typeOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (o) => this.typeOptions.set(o), error: () => (this.typesLoaded = false) });
  }

  markAll(): void {
    const upTo = this.newest();
    if (!upTo || this.marking()) return;
    this.marking.set(true);
    this.api.markAllRead(upTo).subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => ({ ...n, is_read: true })));
        this.stream.refresh();
        this.marking.set(false);
      },
      error: () => this.marking.set(false),
    });
  }

  /** El aviso más nuevo que la persona vio: marcar «hasta aquí» no toca uno que llegó mientras leía. */
  private newest(): string | null {
    return this.items().reduce<string | null>((max, n) => (max === null || n.created_at > max ? n.created_at : max), null);
  }

  private patch(id: string, isRead: boolean): void {
    this.detail.update((d) => (d && d.id === id ? { ...d, is_read: isRead } : d));
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, is_read: isRead } : n)));
    this.stream.adjust(isRead ? -1 : 1);
  }
}
