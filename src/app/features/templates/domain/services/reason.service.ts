import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Control, CreateReasonDto, LinkControlsDto, LinkRisksDto, Reason, ReasonDetail } from '../models/template.models';

interface RawReasonDetail extends Omit<ReasonDetail, 'risks' | 'controls'> {
  risks: { risk: { id: string; name: string; code: string; level: ReasonDetail['risks'][number]['level'] } }[];
  controls: { control: Control }[];
}

@Injectable({ providedIn: 'root' })
export class ReasonService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reasons`;

  getAll(): Observable<Reason[]> {
    return this.http
      .get<ApiResponse<Reason[]>>(this.baseUrl)
      .pipe(unwrapData());
  }

  getById(id: string): Observable<ReasonDetail> {
    return this.http
      .get<ApiResponse<RawReasonDetail>>(`${this.baseUrl}/${id}`)
      .pipe(
        unwrapData(),
        map((reason) => ({
          ...reason,
          risks: reason.risks.map((r) => r.risk),
          controls: reason.controls.map((c) => c.control),
        })),
      );
  }

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
