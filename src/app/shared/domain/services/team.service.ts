import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Invitation, InviteDto, InvitedMember, TeamFilters, TeamMember, TeamPage, UpdateMemberDto } from '../models/team.models';

// El equipo de la empresa (contracts/gestion-usuarios.md, D96, D102). Lo usan el administrador (todo el equipo) y el responsable (solo su equipo; el servidor lo acota):
// errores y sesión ya los resuelven los interceptores globales.
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = `${environment.apiUrl}/users`;

  /** Una página del equipo, con los filtros que se pidan (los vacíos no se mandan). */
  list(filters: TeamFilters = {}, page = 1, pageSize = 25): Observable<TeamPage> {
    let params = new HttpParams().set('page', page).set('page_size', pageSize).set('sort', 'created_at');
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.groupId) params = params.set('group_id', filters.groupId);
    if (filters.isInternal !== null && filters.isInternal !== undefined) params = params.set('is_internal', filters.isInternal);
    return this.http.get<SuccessResponse<TeamPage>>(this.usersUrl, { params }).pipe(unwrapData());
  }

  /** Crea la cuenta y manda la invitación por correo; la respuesta dice si el correo salió (`invitation`), nunca trae el código. */
  invite(dto: InviteDto): Observable<InvitedMember> {
    return this.http.post<SuccessResponse<InvitedMember>>(this.usersUrl, dto).pipe(unwrapData());
  }

  update(id: string, dto: UpdateMemberDto): Observable<TeamMember> {
    return this.http.patch<SuccessResponse<TeamMember>>(`${this.usersUrl}/${id}`, dto).pipe(unwrapData());
  }

  /** Reenvía la invitación: revoca el código vigente y manda uno nuevo por correo (solo mientras la cuenta no se haya activado). Responde solo `invitation`. */
  resendInvitation(id: string): Observable<Invitation> {
    return this.http.post<SuccessResponse<{ invitation: Invitation }>>(`${this.usersUrl}/${id}/activation-code`, {}).pipe(unwrapData(), map((d) => d.invitation));
  }

  /** Quita el segundo factor de alguien que perdió el celular; en su próximo ingreso lo configura de nuevo. */
  resetMfa(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${id}/mfa`);
  }
}
