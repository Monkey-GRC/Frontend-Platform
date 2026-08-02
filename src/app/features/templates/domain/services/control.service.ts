import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Control, CreateControlDto } from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class ControlService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/controls`;

  create(dto: CreateControlDto): Observable<Control> {
    return this.http
      .post<ApiResponse<Control>>(this.baseUrl, dto)
      .pipe(unwrapData());
  }
}
