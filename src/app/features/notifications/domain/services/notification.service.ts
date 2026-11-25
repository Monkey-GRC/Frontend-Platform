import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, EMPTY, expand, map, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { NotificationFilters, NotificationItem, NotificationPageDto, NotificationPreferences } from '../models/notification.models';

export interface NotificationPage {
  items: NotificationItem[];
  page: PageInfo;
}

const MAX_PAGE_SIZE = 100;

// Los avisos de la persona en sesión (contracts/notificaciones.md): la lista de los últimos 90 días, marcar leído, la preferencia del resumen por correo y los tipos.
// El canal en vivo y el contador de la campana son de `NotificationStreamService`.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly catalogs = inject(CatalogService);
  private readonly base = `${environment.apiUrl}/me`;

  list(filters: NotificationFilters = {}): Observable<NotificationPage> {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('page_size', filters.pageSize);
    if (filters.status && filters.status !== 'all') params = params.set('status', filters.status);
    if (filters.type) params = params.set('type', filters.type);
    return this.http.get<SuccessResponse<NotificationPageDto>>(`${this.base}/notifications`, { params }).pipe(
      unwrapData<NotificationPageDto>(),
      map((data) => ({ items: data.items, page: { page: data.page, pageSize: data.page_size, total: data.total, totalPages: data.total_pages } })),
    );
  }

  /** Todos los avisos que pasan los filtros del servidor: recorre las páginas de 100 (son 90 días de una sola persona). El buscador de la pantalla trabaja sobre esto. */
  listAll(filters: Omit<NotificationFilters, 'page' | 'pageSize'> = {}): Observable<NotificationItem[]> {
    const page = (n: number) => this.list({ ...filters, page: n, pageSize: MAX_PAGE_SIZE });
    return page(1).pipe(
      expand((p) => (p.page.page < p.page.totalPages ? page(p.page.page + 1) : EMPTY)),
      reduce<NotificationPage, NotificationItem[]>((all, p) => all.concat(p.items), []),
    );
  }

  unreadCount(): Observable<number> {
    return this.http.get<SuccessResponse<{ unread_count: number }>>(`${this.base}/notifications/unread-count`).pipe(unwrapData(), map((d) => d.unread_count));
  }

  setRead(id: string, isRead: boolean): Observable<NotificationItem> {
    return this.http.patch<SuccessResponse<NotificationItem>>(`${this.base}/notifications/${id}`, { is_read: isRead }).pipe(unwrapData());
  }

  /** Marca como leídos los avisos creados hasta `upTo` (el más nuevo que vio la persona): uno que llegó mientras leía no se marca. */
  markAllRead(upTo?: string): Observable<number> {
    return this.http
      .post<SuccessResponse<{ updated_count: number }>>(`${this.base}/notifications/read-all`, upTo ? { up_to: upTo } : {})
      .pipe(unwrapData(), map((d) => d.updated_count));
  }

  preferences(): Observable<NotificationPreferences> {
    return this.http.get<SuccessResponse<NotificationPreferences>>(`${this.base}/notification-preferences`).pipe(unwrapData());
  }

  setDigest(enabled: boolean): Observable<NotificationPreferences> {
    return this.http.patch<SuccessResponse<NotificationPreferences>>(`${this.base}/notification-preferences`, { is_email_digest_enabled: enabled }).pipe(unwrapData());
  }

  /** Los tipos de aviso con su etiqueta, del catálogo del backend (`CatalogService`: una vez por idioma). */
  typeOptions(): Observable<CatalogOption[]> {
    return this.catalogs.options('notification_type');
  }
}
