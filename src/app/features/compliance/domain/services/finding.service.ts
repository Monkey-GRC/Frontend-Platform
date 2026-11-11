import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { FindingsPage } from '../models/finding.models';

@Injectable({ providedIn: 'root' })
export class FindingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Lo que falló en una prueba de nube de un control y cómo corregirlo (D90). 404 si el control o la prueba no existen o no son de nube. */
  list(controlId: string, testId: string, page = 1, pageSize = 20): Observable<FindingsPage> {
    const params = new HttpParams().set('page', page).set('page_size', pageSize);
    return this.http.get<SuccessResponse<FindingsPage>>(`${this.base}/controls/${controlId}/tests/${testId}/findings`, { params }).pipe(unwrapData());
  }
}