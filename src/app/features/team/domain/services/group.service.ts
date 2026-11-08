import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { CreateGroupDto, Group } from '../models/group.models';

// Los grupos de la empresa (contracts/gestion-usuarios.md → «Grupos»). El administrador ve todos; el responsable, solo el suyo (vacío si aún no lo crea).
// Errores y sesión ya los resuelven los interceptores globales.
@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/groups`;

  /** Todos los grupos visibles para quien pregunta (una empresa tiene pocos; la API pagina hasta 100). */
  list(): Observable<Group[]> {
    const params = new HttpParams().set('page', 1).set('page_size', 100).set('sort', 'name');
    return this.http.get<SuccessResponse<{ items: Group[] }>>(this.url, { params }).pipe(map((r) => r.data?.items ?? []));
  }

  /** Crea un grupo de responsables (administrador, sin `leader_id`) o el equipo de delegados de un responsable (con `leader_id`, o el suyo si lo crea él). */
  create(dto: CreateGroupDto): Observable<Group> {
    return this.http.post<SuccessResponse<Group>>(this.url, dto).pipe(map((r) => r.data!));
  }

  /** Solo el administrador. El grupo «Responsables» (el de por omisión) no se renombra y ningún otro puede llevar ese nombre: el servidor responde 409. */
  rename(id: string, name: string): Observable<Group> {
    return this.http.patch<SuccessResponse<Group>>(`${this.url}/${id}`, { name }).pipe(map((r) => r.data!));
  }
}
