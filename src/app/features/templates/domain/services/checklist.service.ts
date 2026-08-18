import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { ChecklistItem, OperatingSystem } from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/checklist`;

  search(os: OperatingSystem, search?: string): Observable<ChecklistItem[]> {
    const params: Record<string, string> = { os };
    if (search) {
      params['search'] = search;
    }
    return this.http
      .get<ApiResponse<ChecklistItem[]>>(this.baseUrl, { params })
      .pipe(unwrapData());
  }
}
