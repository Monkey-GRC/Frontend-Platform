import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { ComplianceOverview } from '../models/overview.models';

// El resumen de cumplimiento de un servicio. `view` es `technical` solo para auditor, consultor y administrador (`ComplianceViewService.viewParam`).
@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get(serviceId: string, view?: 'technical'): Observable<ComplianceOverview> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http.get<SuccessResponse<ComplianceOverview>>(`${this.base}/services/${serviceId}/compliance-overview`, { params }).pipe(map((r) => r.data!));
  }
}
