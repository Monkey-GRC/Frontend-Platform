import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { PageInfo } from '@shared/domain/utils/pagination';
import {
  ControlDetail,
  ControlDimension,
  ControlFilters,
  ControlListItem,
  ControlResponsible,
  ControlsPageDto,
  ResponsibleCandidate,
  UpdateControlBody,
} from '../models/control.models';

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
      map((r) => {
        const data = r.data!;
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
    return this.http.get<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}`, { params }).pipe(map((r) => r.data!));
  }

  /** Edita la interpretación o las dimensiones al instante (D96). Responde con el control ya cambiado. */
  update(id: string, body: UpdateControlBody, view?: 'technical'): Observable<ControlDetail> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.patch<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}`, body, { params }).pipe(map((r) => r.data!));
  }

  /** Da de baja el control (no lo borra): deja de contar y el histórico se conserva. */
  retire(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/controls/${id}`);
  }

  /** Quién es responsable de cada dimensión del control (D96). */
  responsibles(id: string): Observable<ControlResponsible[]> {
    return this.http.get<SuccessResponse<{ items: ControlResponsible[] }>>(`${this.base}/controls/${id}/responsibles`).pipe(map((r) => r.data?.items ?? []));
  }

  /** Pone o quita (`null`) la excepción de este control en una dimensión; quitarla devuelve el control al responsable del servicio. */
  setResponsible(id: string, dimension: ControlDimension, userId: string | null): Observable<ControlResponsible> {
    return this.http
      .patch<SuccessResponse<ControlResponsible>>(`${this.base}/controls/${id}/responsibles/${dimension}`, { user_id: userId })
      .pipe(map((r) => r.data!));
  }

  /** Las personas funcionales del equipo, con sus especialidades (solo las ve el administrador de la empresa). */
  candidates(): Observable<ResponsibleCandidate[]> {
    const params = new HttpParams().set('role', 'funcional').set('page_size', 100);
    return this.http
      .get<SuccessResponse<{ items: ResponsibleCandidate[] }>>(`${this.base}/users`, { params })
      .pipe(map((r) => (r.data?.items ?? []).filter((u) => u.status !== 'inactive')));
  }
}