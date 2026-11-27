import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Exclusion } from '../models/exclusion.models';
import { Page } from '@shared/domain/models/risk.models';

const PAGE_SIZE = 100;

// Exclusiones de un servicio. Las ven el administrador y el auditor (el responsable y el delegado reciben 403). Las crea y las decide el administrador en un solo acto (D96); crearlas
// (`POST`) desde un control está por construir.
@Injectable({ providedIn: 'root' })
export class ExclusionService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Todas las exclusiones del servicio (recorre las páginas). */
  listAll(serviceId: string): Observable<Exclusion[]> {
    const url = `${this.base}/services/${serviceId}/exclusions`;
    const page = (n: number) => {
      const params = new HttpParams().set('page', n).set('page_size', PAGE_SIZE);
      return this.http.get<SuccessResponse<Page<Exclusion>>>(url, { params }).pipe(unwrapData());
    };
    return page(1).pipe(
      expand((p) => (p.page < p.total_pages ? page(p.page + 1) : EMPTY)),
      reduce<Page<Exclusion>, Exclusion[]>((acc, p) => acc.concat(p.items), []),
    );
  }
}
