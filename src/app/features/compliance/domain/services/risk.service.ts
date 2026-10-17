import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { Cause, LinkedControl, NewTreatment, Page, RiskDetail, RiskEvaluationEntry, RiskListItem, RiskTreatmentRecord } from '../models/risk.models';

const PAGE_SIZE = 100;

// Riesgos y causas de un servicio. `view` es `technical` solo para auditor y consultor (`ComplianceViewService.viewParam`).
// Un servicio trae unos 10 riesgos y 56 causas, así que las listas se cargan completas (`listAll…`) y se agrupan en pantalla con los valores que llegan.
@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Todos los riesgos del servicio (recorre las páginas si hay más de 100). */
  listAllRisks(serviceId: string, view?: 'technical'): Observable<RiskListItem[]> {
    return this.all<RiskListItem>(`${this.base}/services/${serviceId}/risks`, view);
  }

  /** Todas las causas del servicio. */
  listAllCauses(serviceId: string, view?: 'technical'): Observable<Cause[]> {
    return this.all<Cause>(`${this.base}/services/${serviceId}/causes`, view);
  }

  getRisk(id: string, view?: 'technical'): Observable<RiskDetail> {
    return this.http.get<SuccessResponse<RiskDetail>>(`${this.base}/risks/${id}`, { params: this.viewParams(view) }).pipe(map((r) => r.data!));
  }

  getCause(id: string, view?: 'technical'): Observable<Cause> {
    return this.http.get<SuccessResponse<Cause>>(`${this.base}/causes/${id}`, { params: this.viewParams(view) }).pipe(map((r) => r.data!));
  }

  linkCause(riskId: string, causeId: string): Observable<void> {
    return this.http.post<SuccessResponse>(`${this.base}/risks/${riskId}/causes`, { cause_id: causeId }).pipe(map(() => undefined));
  }

  unlinkCause(riskId: string, causeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/risks/${riskId}/causes/${causeId}`);
  }

  linkControl(causeId: string, controlId: string): Observable<LinkedControl> {
    return this.http.post<SuccessResponse<LinkedControl>>(`${this.base}/causes/${causeId}/controls`, { control_id: controlId }).pipe(map((r) => r.data!));
  }

  unlinkControl(causeId: string, controlId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/causes/${causeId}/controls/${controlId}`);
  }

  /** Agrega una evaluación 5×5 (no pisa la anterior); el servidor calcula el valor y el nivel. */
  evaluate(riskId: string, likelihood: number, impact: number): Observable<RiskEvaluationEntry> {
    return this.http.post<SuccessResponse<RiskEvaluationEntry>>(`${this.base}/risks/${riskId}/evaluation`, { likelihood, impact }).pipe(map((r) => r.data!));
  }

  /** Las evaluaciones del riesgo, de la más reciente a la más antigua (no las lee el funcional). */
  evaluationHistory(riskId: string): Observable<RiskEvaluationEntry[]> {
    return this.page<RiskEvaluationEntry>(`${this.base}/risks/${riskId}/evaluation-history`, 1).pipe(map((p) => p.items));
  }

  /** Agrega una decisión de tratamiento; la vigente es la última. */
  createTreatment(riskId: string, body: NewTreatment): Observable<RiskTreatmentRecord> {
    return this.http.post<SuccessResponse<RiskTreatmentRecord>>(`${this.base}/risks/${riskId}/treatments`, body).pipe(map((r) => r.data!));
  }

  treatments(riskId: string): Observable<RiskTreatmentRecord[]> {
    return this.page<RiskTreatmentRecord>(`${this.base}/risks/${riskId}/treatments`, 1).pipe(map((p) => p.items));
  }

  /** Baja lógica: el riesgo deja de aparecer, su historial se conserva. */
  deactivateRisk(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/risks/${id}`);
  }

  deactivateCause(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/causes/${id}`);
  }

  private viewParams(view?: 'technical'): HttpParams | undefined {
    return view ? new HttpParams().set('view', view) : undefined;
  }

  private page<T>(url: string, page: number, view?: 'technical'): Observable<Page<T>> {
    let params = new HttpParams().set('page', page).set('page_size', PAGE_SIZE);
    if (view) params = params.set('view', view);
    return this.http.get<SuccessResponse<Page<T>>>(url, { params }).pipe(map((r) => r.data!));
  }

  private all<T>(url: string, view?: 'technical'): Observable<T[]> {
    return this.page<T>(url, 1, view).pipe(
      expand((p) => (p.page < p.total_pages ? this.page<T>(url, p.page + 1, view) : EMPTY)),
      reduce<Page<T>, T[]>((acc, p) => acc.concat(p.items), []),
    );
  }
}
