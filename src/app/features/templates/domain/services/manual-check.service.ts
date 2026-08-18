import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import {
  CreateManualCheckDto,
  ManualCheckEvidence,
  ManualCheckEvidenceWithUrl,
  ManualCheckItem,
  SetManualCheckStatusDto,
  UpdateManualCheckDto,
} from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class ManualCheckService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  listByControl(controlId: string): Observable<ManualCheckItem[]> {
    return this.http
      .get<ApiResponse<ManualCheckItem[]>>(`${this.baseUrl}/controls/${controlId}/manual-checks`)
      .pipe(unwrapData());
  }

  create(controlId: string, dto: CreateManualCheckDto): Observable<ManualCheckItem> {
    return this.http
      .post<ApiResponse<ManualCheckItem>>(`${this.baseUrl}/controls/${controlId}/manual-checks`, dto)
      .pipe(unwrapData());
  }

  update(id: string, dto: UpdateManualCheckDto): Observable<ManualCheckItem> {
    return this.http
      .patch<ApiResponse<ManualCheckItem>>(`${this.baseUrl}/manual-checks/${id}`, dto)
      .pipe(unwrapData());
  }

  setStatus(id: string, dto: SetManualCheckStatusDto): Observable<ManualCheckItem> {
    return this.http
      .patch<ApiResponse<ManualCheckItem>>(`${this.baseUrl}/manual-checks/${id}/status`, dto)
      .pipe(unwrapData());
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/manual-checks/${id}`)
      .pipe(unwrapData());
  }

  uploadEvidence(manualCheckId: string, file: File): Observable<ManualCheckEvidence> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<ManualCheckEvidence>>(`${this.baseUrl}/manual-checks/${manualCheckId}/evidence`, formData)
      .pipe(unwrapData());
  }

  listEvidence(manualCheckId: string): Observable<ManualCheckEvidenceWithUrl[]> {
    return this.http
      .get<ApiResponse<ManualCheckEvidenceWithUrl[]>>(`${this.baseUrl}/manual-checks/${manualCheckId}/evidence`)
      .pipe(unwrapData());
  }

  removeEvidence(manualCheckId: string, evidenceId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/manual-checks/${manualCheckId}/evidence/${evidenceId}`)
      .pipe(unwrapData());
  }
}
