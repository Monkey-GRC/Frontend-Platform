import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
// Único cruce de `home` hacia `team`: el Inicio no tiene otra fuente de las personas que `GET /v1/users`, y duplicar ese servicio (URL, filtros, paginación) sería peor.
// Todo lo demás de `home` usa solo el modelo propio (`HomeTeamMember`).
import { TeamMember, TeamPage } from '@shared/domain/models/team.models';
import { TeamService } from '@shared/domain/services/team.service';
import { HomeTeamLoad, HomeTeamMember } from '../models/team.models';

const PAGE_SIZE = 100; // el máximo que acepta la API (conventions.md)
export const MAX_PAGES = 10; // tope de seguridad: 1000 personas
export const MAX_PEOPLE = PAGE_SIZE * MAX_PAGES;

function toHomeMember(m: TeamMember): HomeTeamMember {
  return { role: m.role, status: m.status, mfaEnabled: m.is_mfa_enabled, lastLoginAt: m.last_login_at };
}

// Las personas del equipo para el resumen del Inicio: se reutiliza `TeamService.list` tal cual (el servidor acota la lista según el rol) y se piden las páginas que haga falta.
// Si hay más de `MAX_PAGES` páginas se corta y se avisa (`partial`) en vez de contar mal en silencio.
@Injectable({ providedIn: 'root' })
export class HomeTeamService {
  private readonly team = inject(TeamService);

  loadAll(): Observable<HomeTeamLoad> {
    return this.team.list({}, 1, PAGE_SIZE).pipe(
      expand((p) => (p.page < p.total_pages && p.page < MAX_PAGES ? this.team.list({}, p.page + 1, PAGE_SIZE) : EMPTY)),
      reduce((acc, p: TeamPage) => ({ members: [...acc.members, ...p.items.map(toHomeMember)], partial: p.page < p.total_pages }), { members: [], partial: false } as HomeTeamLoad),
    );
  }
}
