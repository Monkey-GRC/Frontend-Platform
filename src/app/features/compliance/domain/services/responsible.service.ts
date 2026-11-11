import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Page, Responsible } from '@shared/domain/models/risk.models';

// Los cargos responsables de la organización (compliance-responsibles.md, MD-133): quien responde de un tratamiento de riesgo, de una evidencia o de un activo.
// Es un cargo con el nombre de una persona, no un usuario con cuenta. Los ven todos los roles de la empresa; los gestiona el administrador.
@Injectable({ providedIn: 'root' })
export class ResponsibleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(): Observable<Responsible[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http.get<SuccessResponse<Page<Responsible>>>(`${this.base}/responsibles`, { params }).pipe(map((r) => r.data?.items ?? []));
  }

  create(type: string, personName: string): Observable<Responsible> {
    return this.http.post<SuccessResponse<Responsible>>(`${this.base}/responsibles`, { type, person_name: personName }).pipe(unwrapData());
  }

  /** Cambia la persona del cargo; todo lo que apuntaba a él sigue apuntándole. El tipo no cambia. */
  rename(id: string, personName: string): Observable<Responsible> {
    return this.http.patch<SuccessResponse<Responsible>>(`${this.base}/responsibles/${id}`, { person_name: personName }).pipe(unwrapData());
  }

  /** Quitar un cargo del que algo depende responde 409: primero se reasigna lo que apunta a él. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/responsibles/${id}`);
  }
}
