import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { WorkPage, WorkPageDto } from '../models/work.models';

// `GET /v1/me/work` (gestion-usuarios.md). La bandeja «Por aprobar» es el bucket `to_review`; la lista es del servidor (páginas).
@Injectable({ providedIn: 'root' })
export class WorkService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/me/work`;

  toReview(page: number, pageSize: number): Observable<WorkPage> {
    const params = new HttpParams().set('bucket', 'to_review').set('page', page).set('page_size', pageSize);
    return this.http.get<SuccessResponse<WorkPageDto>>(this.url, { params }).pipe(
      unwrapData<WorkPageDto>(),
      map((d) => ({ items: d.items, page: { page: d.page, pageSize: d.page_size, total: d.total, totalPages: d.total_pages } })),
    );
  }
}
