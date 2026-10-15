import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { ComplianceServiceRef } from '../models/compliance.models';

interface ServicesPage {
  items: ComplianceServiceRef[];
}

// Los servicios de la empresa, solo para elegir a cuál entrar desde el menú. No importa de `features/services`
// (las features no se cruzan): lee solo `id` y `name` del mismo endpoint.
@Injectable({ providedIn: 'root' })
export class ComplianceServicesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/services`;

  list(): Observable<ComplianceServiceRef[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http
      .get<SuccessResponse<ServicesPage>>(this.url, { params })
      .pipe(map((r) => (r.data?.items ?? []).map(({ id, name }) => ({ id, name }))));
  }
}
