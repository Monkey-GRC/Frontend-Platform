import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CreateRiskDto, Risk } from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/risks`;

  create(dto: CreateRiskDto): Observable<Risk> {
    return this.http
      .post<ApiResponse<Risk>>(this.baseUrl, dto)
      .pipe(unwrapData());
  }
}
