import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { AssignmentFilters, AssignmentItem, AssignmentPageDto, AssignmentResult } from '../models/assignment.models';

export interface AssignmentPage {
  items: AssignmentItem[];
  page: PageInfo;
}

// La asignación de dueño y ejecutor de los controles (contracts/gestion-usuarios.md). La lista es del servidor (filtros, orden y páginas); asignar es masivo (hasta 200 controles).
// Errores y sesión los resuelven los interceptores globales.
@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/assignments`;

  list(filters: AssignmentFilters = {}): Observable<AssignmentPage> {
    let params = new HttpParams().set('page', filters.page ?? 1).set('page_size', filters.pageSize ?? 25);
    if (filters.serviceId) params = params.set('service_id', filters.serviceId);
    if (filters.assignment) params = params.set('assignment', filters.assignment);
    if (filters.ownerId) params = params.set('owner_id', filters.ownerId);
    if (filters.executorId) params = params.set('executor_id', filters.executorId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.q?.trim()) params = params.set('q', filters.q.trim());
    return this.http.get<SuccessResponse<AssignmentPageDto>>(this.url, { params }).pipe(
      unwrapData<AssignmentPageDto>(),
      map((d) => ({ items: d.items, page: { page: d.page, pageSize: d.page_size, total: d.total, totalPages: d.total_pages } })),
    );
  }

  /** Solo el administrador. `ownerId: null` deja los controles sin asignar; al cambiar el dueño, el ejecutor se limpia. */
  setOwner(clientControlIds: string[], ownerId: string | null): Observable<AssignmentResult> {
    return this.http.put<SuccessResponse<AssignmentResult>>(`${this.url}/owner`, { client_control_ids: clientControlIds, owner_id: ownerId }).pipe(unwrapData());
  }

  /** El administrador y el responsable (sobre sus controles). `executorId: null` quita al delegado: ejecuta el dueño. */
  setExecutor(clientControlIds: string[], executorId: string | null): Observable<AssignmentResult> {
    return this.http.put<SuccessResponse<AssignmentResult>>(`${this.url}/executor`, { client_control_ids: clientControlIds, executor_id: executorId }).pipe(unwrapData());
  }
}
