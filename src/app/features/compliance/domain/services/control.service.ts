import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { ControlDetail, ControlFilters, ControlListItem, ControlsPageDto, UpdateControlBody, UpdatePeriodicityBody } from '../models/control.models';

export interface ControlsPage {
  items: ControlListItem[];
  page: PageInfo;
}

// Acciones de protección de un servicio. `view` es `technical` solo para auditor y administrador de la empresa (`ComplianceViewService.viewParam`);
// para el resto no se manda, y el backend responde 403 si alguien más la pide.
@Injectable({ providedIn: 'root' })
export class ControlService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(serviceId: string, filters: ControlFilters, view?: 'technical'): Observable<ControlsPage> {
    let params = new HttpParams().set('page', filters.page).set('page_size', filters.pageSize);
    if (filters.trustCriterion) params = params.set('trust_criterion', filters.trustCriterion);
    if (filters.readiness) params = params.set('readiness', filters.readiness);
    if (view) params = params.set('view', view);
    return this.http.get<SuccessResponse<ControlsPageDto>>(`${this.base}/services/${serviceId}/controls`, { params }).pipe(
      unwrapData<ControlsPageDto>(),
      map((data) => {
        return { items: data.items, page: { page: data.page, pageSize: data.page_size, total: data.total, totalPages: data.total_pages } };
      }),
    );
  }

  /** Todos los controles del servicio (para elegir uno al vincularlo a una causa): recorre las páginas de 100. */
  listAll(serviceId: string, view?: 'technical'): Observable<ControlListItem[]> {
    const page = (n: number) => this.list(serviceId, { page: n, pageSize: 100 }, view);
    return page(1).pipe(
      expand((p) => (p.page.page < p.page.totalPages ? page(p.page.page + 1) : EMPTY)),
      reduce<ControlsPage, ControlListItem[]>((acc, p) => acc.concat(p.items), []),
    );
  }

  get(id: string, view?: 'technical'): Observable<ControlDetail> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.get<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}`, { params }).pipe(unwrapData());
  }

  /** Edita la interpretación o las dimensiones al instante (D96). Responde con el control ya cambiado. */
  update(id: string, body: UpdateControlBody, view?: 'technical'): Observable<ControlDetail> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.patch<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}`, body, { params }).pipe(unwrapData());
  }

  /** Cambia la periodicidad de todos los requisitos del control (solo el administrador de la empresa, D147). Responde con el detalle ya recalculado. */
  setPeriodicity(id: string, body: UpdatePeriodicityBody, view?: 'technical'): Observable<ControlDetail> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.put<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}/periodicity`, body, { params }).pipe(unwrapData());
  }

  /** Da de baja el control (no lo borra): deja de contar y el histórico se conserva. */
  retire(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/controls/${id}`);
  }
}