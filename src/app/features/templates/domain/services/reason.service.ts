import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CreateReasonDto, LinkControlsDto, LinkRisksDto, Reason } from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class ReasonService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reasons`;

  create(dto: CreateReasonDto): Observable<Reason> {
    return this.http
      .post<ApiResponse<Reason>>(this.baseUrl, dto)
      .pipe(unwrapData());
  }

  linkRisks(id: string, dto: LinkRisksDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/${id}/risks`, dto);
  }

  linkControls(id: string, dto: LinkControlsDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/${id}/controls`, dto);
  }
}
