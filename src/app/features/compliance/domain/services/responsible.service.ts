import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { Page, Responsible } from '../models/risk.models';

// Los cargos responsables de la organización (compliance-responsibles.md, MD-133): quien responde de un tratamiento de riesgo o de una evidencia. Es un cargo
// con el nombre de una persona, no un usuario con cuenta. Los ven todos los roles de la empresa.
@Injectable({ providedIn: 'root' })
export class ResponsibleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(): Observable<Responsible[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http.get<SuccessResponse<Page<Responsible>>>(`${this.base}/responsibles`, { params }).pipe(map((r) => r.data?.items ?? []));
  }
}