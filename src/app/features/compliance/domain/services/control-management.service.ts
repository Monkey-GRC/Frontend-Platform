import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import {
  AssigneeOption, DecisionBody, LevelOverride, LevelOverrideBody, ManagementHistoryItem, NotApplicableRequest, Occurrence, OccurrenceBody, RemediationPlan, RemediationPlanBody,
} from '../models/control.models';

interface PageDto<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ManagementPage<T> {
  items: T[];
  page: PageInfo;
}

const toPage = <T>(d: PageDto<T>): ManagementPage<T> => ({ items: d.items, page: { page: d.page, pageSize: d.page_size, total: d.total, totalPages: d.total_pages } });

// MD-529 · Lo que el responsable propone y el administrador decide sobre un control (`aprobacion.md`): nivel, plan de remediación, «No aplica», ocurrencias y el historial.
// Cada escritura responde con el acto; la pantalla vuelve a pedir el control.
@Injectable({ providedIn: 'root' })
export class ControlManagementService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  proposeLevel(controlId: string, body: LevelOverrideBody): Observable<LevelOverride> {
    return this.http.post<SuccessResponse<LevelOverride>>(`${this.base}/controls/${controlId}/level-overrides`, body).pipe(unwrapData());
  }

  decideLevel(id: string, body: DecisionBody): Observable<LevelOverride> {
    return this.http.post<SuccessResponse<LevelOverride>>(`${this.base}/level-overrides/${id}/decision`, body).pipe(unwrapData());
  }

  registerPlan(controlId: string, body: RemediationPlanBody): Observable<RemediationPlan> {
    return this.http.post<SuccessResponse<RemediationPlan>>(`${this.base}/controls/${controlId}/remediation-plans`, body).pipe(unwrapData());
  }

  decidePlan(id: string, body: DecisionBody): Observable<RemediationPlan> {
    return this.http.post<SuccessResponse<RemediationPlan>>(`${this.base}/remediation-plans/${id}/decision`, body).pipe(unwrapData());
  }

  requestNotApplicable(controlId: string, requirementId: string, reason: string): Observable<NotApplicableRequest> {
    return this.http.post<SuccessResponse<NotApplicableRequest>>(`${this.base}/controls/${controlId}/requirements/${requirementId}/not-applicable-requests`, { reason }).pipe(unwrapData());
  }

  decideNotApplicable(id: string, body: DecisionBody): Observable<NotApplicableRequest> {
    return this.http.post<SuccessResponse<NotApplicableRequest>>(`${this.base}/not-applicable-requests/${id}/decision`, body).pipe(unwrapData());
  }

  /** Vuelve a medir el requisito: directo, sin aprobación. */
  revertNotApplicable(controlId: string, requirementId: string, reason: string): Observable<NotApplicableRequest> {
    return this.http.post<SuccessResponse<NotApplicableRequest>>(`${this.base}/controls/${controlId}/requirements/${requirementId}/not-applicable/revert`, { reason }).pipe(unwrapData());
  }

  registerOccurrence(controlId: string, requirementId: string, body: OccurrenceBody): Observable<Occurrence> {
    return this.http.post<SuccessResponse<Occurrence>>(`${this.base}/controls/${controlId}/requirements/${requirementId}/occurrences`, body).pipe(unwrapData());
  }

  /** Las ocurrencias del requisito, la más reciente primero (para elegir el caso al subir su evidencia). */
  listOccurrences(controlId: string, requirementId: string): Observable<Occurrence[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http.get<SuccessResponse<PageDto<Occurrence>>>(`${this.base}/controls/${controlId}/requirements/${requirementId}/occurrences`, { params }).pipe(unwrapData(), map((d) => d.items));
  }

  declareNoOccurrences(controlId: string, requirementId: string): Observable<unknown> {
    return this.http.post<SuccessResponse<unknown>>(`${this.base}/controls/${controlId}/requirements/${requirementId}/no-occurrence-declarations`, {}).pipe(unwrapData());
  }

  /** El historial de gestión, el más reciente primero. */
  history(controlId: string, page: number, pageSize = 10): Observable<ManagementPage<ManagementHistoryItem>> {
    const params = new HttpParams().set('page', page).set('page_size', pageSize).set('sort', '-at');
    return this.http.get<SuccessResponse<PageDto<ManagementHistoryItem>>>(`${this.base}/controls/${controlId}/management-history`, { params }).pipe(unwrapData(), map(toPage));
  }

  /** Las personas de la empresa a quienes se puede dar un plan: el directorio, abierto a quien lo registra. */
  assignees(): Observable<AssigneeOption[]> {
    return this.http.get<SuccessResponse<{ items: AssigneeOption[] }>>(`${this.base}/users/directory`).pipe(unwrapData(), map((d) => d.items));
  }
}
