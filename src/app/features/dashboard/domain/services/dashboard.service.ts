import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { ControlChecksDetail, DashboardControl, DashboardServerCompliance, DashboardSummary } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  readSummary(): Observable<ApiResponse<DashboardSummary>> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.baseUrl}/summary`);
  }

  readControls(): Observable<ApiResponse<DashboardControl[]>> {
    return this.http.get<ApiResponse<DashboardControl[]>>(`${this.baseUrl}/controls`);
  }

  readServers(): Observable<ApiResponse<DashboardServerCompliance[]>> {
    return this.http.get<ApiResponse<DashboardServerCompliance[]>>(`${this.baseUrl}/servers`);
  }

  readControlChecks(id: string): Observable<ApiResponse<ControlChecksDetail>> {
    return this.http.get<ApiResponse<ControlChecksDetail>>(`${this.baseUrl}/controls/${id}/checks`);
  }
}
