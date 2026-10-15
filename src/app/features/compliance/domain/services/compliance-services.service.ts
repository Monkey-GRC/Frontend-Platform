import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { ComplianceServiceRef } from '../models/compliance.models';

interface ServicesPage {
  items: ComplianceServiceRef[];
}

// Los servicios de la empresa, para elegir a cuál entrar desde el menú, decir de cuál se habla en el encabezado y cambiar de uno a otro. No importa de
// `features/services` (las features no se cruzan): lee solo `id`, `name` y los marcos del mismo endpoint. Solo el `admin_empresa` puede leerlo (B1).
@Injectable({ providedIn: 'root' })
export class ComplianceServicesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/services`;

  list(): Observable<ComplianceServiceRef[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http
      .get<SuccessResponse<ServicesPage>>(this.url, { params })
      .pipe(map((r) => (r.data?.items ?? []).map(({ id, name, frameworks }) => ({ id, name, frameworks: frameworks ?? [] }))));
  }
}
