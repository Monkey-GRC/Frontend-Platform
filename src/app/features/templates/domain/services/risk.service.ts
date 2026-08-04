import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CreateRiskDto, Risk, RiskDetail, UpdateRiskDto } from '../models/template.models';

interface RawRiskDetail extends Omit<RiskDetail, 'reasons'> {
  reasons: { reason: { id: string; name: string; code: string } }[];
}

@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/risks`;

  getAll(): Observable<Risk[]> {
    return this.http
      .get<ApiResponse<Risk[]>>(this.baseUrl)
      .pipe(unwrapData());
  }

  getById(id: string): Observable<RiskDetail> {
    return this.http
      .get<ApiResponse<RawRiskDetail>>(`${this.baseUrl}/${id}`)
      .pipe(
        unwrapData(),
        map((risk) => ({ ...risk, reasons: risk.reasons.map((r) => r.reason) })),
      );
  }

  create(dto: CreateRiskDto): Observable<Risk> {
    return this.http
      .post<ApiResponse<Risk>>(this.baseUrl, dto)
      .pipe(unwrapData());
  }

  update(id: string, dto: UpdateRiskDto): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${this.baseUrl}/${id}`, dto);
  }
}
