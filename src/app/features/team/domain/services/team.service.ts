import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import {
  Dimension,
  DimensionOwner,
  InviteDto,
  ServiceRef,
  TeamMemberWithCode,
  TeamMember,
  TeamPage,
  UpdateMemberDto,
} from '../models/team.models';

// El equipo de la empresa (contracts/modules/users-team.md, D96). Solo el administrador de la empresa lo usa: errores y sesión ya los resuelven los interceptores globales.
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = `${environment.apiUrl}/users`;

  list(page = 1, pageSize = 100): Observable<TeamPage> {
    const params = new HttpParams().set('page', page).set('page_size', pageSize).set('sort', 'created_at');
    return this.http.get<SuccessResponse<TeamPage>>(this.usersUrl, { params }).pipe(map((r) => r.data!));
  }

  /** Crea la cuenta; la respuesta trae el código de activación, que no se vuelve a poder ver. */
  invite(dto: InviteDto): Observable<TeamMemberWithCode> {
    return this.http.post<SuccessResponse<TeamMemberWithCode>>(this.usersUrl, dto).pipe(map((r) => r.data!));
  }

  update(id: string, dto: UpdateMemberDto): Observable<TeamMember> {
    return this.http.patch<SuccessResponse<TeamMember>>(`${this.usersUrl}/${id}`, dto).pipe(map((r) => r.data!));
  }

  /** Revoca el código vigente y emite uno nuevo (solo mientras la cuenta no se haya activado). */
  reissueCode(id: string): Observable<TeamMemberWithCode> {
    return this.http.post<SuccessResponse<TeamMemberWithCode>>(`${this.usersUrl}/${id}/activation-code`, {}).pipe(map((r) => r.data!));
  }

  /** Quita el segundo factor de alguien que perdió el celular; en su próximo ingreso lo configura de nuevo. */
  resetMfa(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${id}/mfa`);
  }

  /** Los servicios de la empresa, para elegir en cuál se reparte el trabajo. */
  services(): Observable<ServiceRef[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100);
    return this.http
      .get<SuccessResponse<{ items: ServiceRef[] }>>(`${environment.apiUrl}/services`, { params })
      .pipe(map((r) => (r.data?.items ?? []).map((s) => ({ id: s.id, name: s.name }))));
  }

  dimensionOwners(serviceId: string): Observable<DimensionOwner[]> {
    return this.http
      .get<SuccessResponse<{ items: DimensionOwner[] }>>(`${environment.apiUrl}/services/${serviceId}/dimension-owners`)
      .pipe(map((r) => r.data?.items ?? []));
  }

  /** `userId: null` deja la dimensión sin responsable del servicio. */
  setDimensionOwner(serviceId: string, dimension: Dimension, userId: string | null): Observable<DimensionOwner> {
    return this.http
      .patch<SuccessResponse<DimensionOwner>>(`${environment.apiUrl}/services/${serviceId}/dimension-owners/${dimension}`, { user_id: userId })
      .pipe(map((r) => r.data!));
  }
}
