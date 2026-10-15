import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { PageInfo } from '@shared/domain/utils/pagination';
import {
  ControlChange,
  ControlDetail,
  ControlFilters,
  ControlListItem,
  ControlsPageDto,
  ProposeChangeBody,
} from '../models/control.models';

export interface ControlsPage {
  items: ControlListItem[];
  page: PageInfo;
}

// Acciones de protección de un servicio. `view` es `technical` solo para auditor y consultor (`ComplianceViewService.viewParam`);
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

  get(id: string, view?: 'technical'): Observable<ControlDetail> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.get<SuccessResponse<ControlDetail>>(`${this.base}/controls/${id}`, { params }).pipe(map((r) => r.data!));
  }

  /** Propone un cambio (editar la interpretación, las dimensiones o dar de baja). No cambia la acción hasta que el consultor lo apruebe. */
  proposeChange(id: string, body: ProposeChangeBody): Observable<ControlChange> {
    return this.http.post<SuccessResponse<ControlChange>>(`${this.base}/controls/${id}/changes`, body).pipe(map((r) => r.data!));
  }

  /** Las propuestas de una acción, de la más reciente a la más antigua. */
  changes(id: string, status?: 'pending' | 'approved' | 'rejected'): Observable<ControlChange[]> {
    let params = new HttpParams().set('page_size', 100);
    if (status) params = params.set('status', status);
    return this.http
      .get<SuccessResponse<{ items: ControlChange[] }>>(`${this.base}/controls/${id}/changes`, { params })
      .pipe(map((r) => r.data?.items ?? []));
  }
}
