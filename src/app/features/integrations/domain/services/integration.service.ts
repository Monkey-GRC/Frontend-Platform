import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CatalogIntegration, Integration, IntegrationDetail } from '../models/integration.models';

// La sección Integraciones (contracts/integraciones.md, D110). No conecta nada: solo lista; conectar es el flujo por servicio.
@Injectable({ providedIn: 'root' })
export class IntegrationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/integrations`;

  /** Las integraciones que la empresa ya tiene (admin_empresa y auditor). */
  list(): Observable<Integration[]> {
    return this.http.get<SuccessResponse<{ items: Integration[] }>>(this.url).pipe(unwrapData(), map((d) => d.items));
  }

  /** El catálogo para agregar una (solo admin_empresa). */
  catalog(): Observable<CatalogIntegration[]> {
    return this.http.get<SuccessResponse<{ items: CatalogIntegration[] }>>(`${this.url}/catalog`).pipe(unwrapData(), map((d) => d.items));
  }

  /** El detalle de una integración (404 si no existe o, para el auditor, la empresa no la tiene). */
  getDetail(code: string): Observable<IntegrationDetail> {
    return this.http.get<SuccessResponse<IntegrationDetail>>(`${this.url}/${encodeURIComponent(code)}`).pipe(unwrapData());
  }
}
