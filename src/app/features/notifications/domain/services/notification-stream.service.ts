import { DestroyRef, Injectable, InjectionToken, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { StreamNotification, StreamReady } from '../models/notification.models';
import { NotificationService } from './notification.service';

/** Abre el canal en vivo. Es un token para sustituirlo en las pruebas; la cookie de sesión viaja sola con `withCredentials`. */
export const EVENT_SOURCE_FACTORY = new InjectionToken<(url: string) => EventSource>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url, { withCredentials: true }),
});

export const STREAM_RETRY_BASE_MS = 1000;
export const STREAM_RETRY_MAX_MS = 30_000;
/** Mientras el canal está caído, el contador se consulta cada 60 s (contracts/notificaciones.md). */
export const STREAM_FALLBACK_POLL_MS = 60_000;

/** Espera antes del intento `attempt` (desde 0): 1 s, 2 s, 4 s… hasta 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(STREAM_RETRY_MAX_MS, STREAM_RETRY_BASE_MS * 2 ** Math.max(0, attempt));
}

/** Lee el mensaje de un evento; si no es JSON o no trae `unread_count` como número, se ignora (el contador nunca queda en `undefined` ni en texto). */
function parse<T extends { unread_count: number }>(event: Event): T | null {
  try {
    const value: unknown = JSON.parse((event as MessageEvent<string>).data);
    if (typeof value !== 'object' || value === null) return null;
    const count = (value as { unread_count?: unknown }).unread_count;
    return typeof count === 'number' && Number.isFinite(count) ? (value as T) : null;
  } catch {
    return null;
  }
}

/**
 * El número de la campana y el canal en vivo (`GET /v1/me/notifications/stream`, Server-Sent Events).
 * `start()` abre el canal (la campana lo hace al aparecer) y `stop()` lo cierra: al desaparecer la campana, al cerrar sesión o al destruirse el servicio.
 * Si el canal cae, se cierra, se consulta el contador cada 60 s y se reintenta con espera creciente: antes de cada intento se pide el contador por HTTP, y esa petición
 * renueva la sesión si venció (el EventSource no sabe de un 401). `changes` sube con cada aviso nuevo o cambio de contador que llegue de fuera (otra pestaña): las listas se actualizan con él.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private readonly api = inject(NotificationService);
  private readonly session = inject(SessionService);
  private readonly openSource = inject(EVENT_SOURCE_FACTORY);

  private readonly count = signal(0);
  private readonly isConnected = signal(false);
  private readonly changeTick = signal(0);
  // Sube con cada contador que llega por el canal: una respuesta HTTP que salió antes de él ya es vieja.
  private liveSeq = 0;

  readonly unreadCount = this.count.asReadonly();
  readonly connected = this.isConnected.asReadonly();
  readonly changes = this.changeTick.asReadonly();

  private running = false;
  private attempt = 0;
  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private requests = new Subscription();

  constructor() {
    // Sin sesión no hay canal: cerrar sesión (o perderla) lo cierra.
    effect(() => {
      if (this.session.user() === null) this.stop();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Abre el canal; devuelve `true` si lo abrió esta llamada y `false` si ya estaba abierto (quien no lo abrió no debe cerrarlo). */
  start(): boolean {
    if (this.running) return false;
    this.running = true;
    this.attempt = 0;
    this.refresh();
    this.open();
    return true;
  }

  stop(): void {
    this.running = false;
    this.closeSource();
    this.clearRetry();
    this.stopPolling();
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.isConnected.set(false);
    this.count.set(0);
  }

  /** Pide el contador al servidor (al empezar, tras marcar y mientras el canal está caído). */
  refresh(): void {
    const seen = this.liveSeq;
    this.requests.add(
      this.api.unreadCount().subscribe({
        next: (n) => {
          if (seen === this.liveSeq) this.count.set(n);
        },
        error: () => undefined,
      }),
    );
  }

  /** Ajusta el contador al instante tras marcar un aviso (antes de que el servidor confirme). */
  adjust(delta: number): void {
    this.count.update((n) => Math.max(0, n + delta));
  }

  private open(): void {
    if (!this.running) return;
    this.closeSource();
    const source = this.openSource(`${environment.apiUrl}/me/notifications/stream`);
    this.source = source;
    source.addEventListener('ready', (event) => {
      const data = parse<StreamReady>(event);
      this.attempt = 0;
      this.stopPolling();
      this.isConnected.set(true);
      if (data) this.setLive(data.unread_count);
    });
    source.addEventListener('notification', (event) => {
      const data = parse<StreamNotification>(event);
      if (!data) return;
      this.setLive(data.unread_count);
      this.changeTick.update((n) => n + 1);
    });
    source.addEventListener('unread_count', (event) => {
      const data = parse<StreamReady>(event);
      if (!data) return;
      this.setLive(data.unread_count);
      this.changeTick.update((n) => n + 1);
    });
    source.addEventListener('error', () => this.dropped(source));
  }

  private setLive(value: number): void {
    this.liveSeq += 1;
    this.count.set(Math.max(0, value));
  }

  private dropped(source: EventSource): void {
    if (source !== this.source || !this.running) return;
    this.closeSource();
    this.isConnected.set(false);
    this.startPolling();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.running) return;
      this.attempt += 1;
      this.requests.add(
        this.api.unreadCount().subscribe({
          next: (n) => {
            this.count.set(n);
            this.open();
          },
          error: () => {
            if (this.running) this.scheduleReconnect();
          },
        }),
      );
    }, reconnectDelay(this.attempt));
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.refresh(), STREAM_FALLBACK_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private closeSource(): void {
    this.source?.close();
    this.source = null;
  }
}
