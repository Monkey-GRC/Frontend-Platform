import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { ComplianceOverview, EvaluationPeriodBody, EvaluationPeriodResult } from '../models/overview.models';

// El resumen de cumplimiento de un servicio. `view` es `technical` solo para auditor y administrador de la empresa (`ComplianceViewService.viewParam`).
@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get(serviceId: string, view?: 'technical'): Observable<ComplianceOverview> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.get<SuccessResponse<ComplianceOverview>>(`${this.base}/services/${serviceId}/compliance-overview`, { params }).pipe(unwrapData());
  }

  /** Declara (o cambia) el período auditado de un marco del servicio y, si se manda `cutoff_date`, congela la fecha de corte (D87, MD-168). Solo el administrador de la empresa. */
  setEvaluationPeriod(serviceId: string, frameworkCode: string, body: EvaluationPeriodBody): Observable<EvaluationPeriodResult> {
    return this.http.put<SuccessResponse<EvaluationPeriodResult>>(`${this.base}/services/${serviceId}/frameworks/${frameworkCode}/evaluation-period`, body).pipe(unwrapData());
  }
}
