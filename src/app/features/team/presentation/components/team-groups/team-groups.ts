import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { CreateGroupDto, Group } from '../../../domain/models/group.models';
import { TeamActor, TeamMember } from '../../../domain/models/team.models';
import { GroupService } from '../../../domain/services/group.service';
import { TeamService } from '../../../domain/services/team.service';
import { GroupMembers } from '../group-members/group-members';

const MAX_NAME = 100;

// Los grupos de la empresa (MD-198, contracts/gestion-usuarios.md → «Grupos», D102, D104). Un grupo tiene un nombre y un líder; cada persona (salvo administrador y auditor) pertenece a uno.
//  · El administrador lidera uno o varios grupos de responsables, crea el equipo de delegados de cualquier responsable y renombra los grupos.
//  · El responsable crea SU equipo cuando quiere (D104: no nace con su cuenta; mientras no lo cree, trabaja solo). Solo puede liderar uno.
// Mover a un delegado de equipo es del administrador. No hay borrar grupos en este sprint.
@Component({
  selector: 'app-team-groups',
  imports: [TranslatePipe, GroupMembers],
  templateUrl: './team-groups.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamGroups implements OnInit {
  private readonly groupApi = inject(GroupService);
  private readonly teamApi = inject(TeamService);
  private readonly translate = inject(TranslateService);
  private readonly session = inject(SessionService);

  readonly actor = input.required<TeamActor>();
  /** Los grupos que ve quien pregunta: todos si es administrador; el suyo si es responsable (vacío mientras no lo cree). */
  readonly groups = input<Group[]>([]);
  /** Hasta que los grupos llegan no se dice «aún no hay grupos» ni se ofrece crear el equipo propio (quizá ya existe). */
  readonly loaded = input(true);
  /** Se creó o renombró un grupo, o se movió a alguien: la pantalla debe volver a pedir los grupos y las personas. */
  readonly changed = output<void>();
  /** Para el administrador: los responsables, para elegir de quién se crea el equipo. */
  private readonly responsables = signal<TeamMember[]>([]);

  readonly maxName = MAX_NAME;
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);

  readonly responsablesGroupName = signal('');
  readonly teamName = signal('');
  readonly teamLeaderId = signal('');
  readonly ownTeamName = signal('');

  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');

  readonly isAdmin = computed(() => this.actor() === 'admin_empresa');
  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));
  /** El equipo que lidera el responsable (la API solo le devuelve el suyo). */
  readonly ownTeam = computed(() => this.teams()[0] ?? null);

  /** Los responsables vigentes (activos o pendientes) que aún no lideran un equipo: el servidor rechaza un segundo equipo (`TEAM_ALREADY_EXISTS`). */
  readonly eligibleLeaders = computed(() => {
    const leading = new Set(this.teams().map((g) => g.leader.id));
    return this.responsables().filter((m) => (m.status === 'active' || m.status === 'pending') && !leading.has(m.id));
  });

  readonly canCreateResponsablesGroup = computed(() => !!this.responsablesGroupName().trim() && !this.saving());
  readonly canCreateTeam = computed(() => !!this.teamName().trim() && !!this.teamLeaderId() && !this.saving());
  readonly canCreateOwnTeam = computed(() => !!this.ownTeamName().trim() && !this.saving());
  readonly canRename = computed(() => {
    const draft = this.renameDraft().trim();
    const current = this.groups().find((g) => g.id === this.renamingId());
    return !!draft && !!current && draft !== current.name && !this.saving();
  });

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.teamApi.list({ role: 'responsable' }, 1, 100).subscribe({ next: (page) => this.responsables.set(page.items), error: () => this.responsables.set([]) });
    } else {
      // Un nombre de partida para el equipo propio; se puede cambiar antes de crearlo.
      const name = this.session.user()?.name?.trim();
      this.ownTeamName.set(name ? this.translate.instant('TEAM.GROUPS.DEFAULT_TEAM_NAME', { name }) : '');
    }
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  leaderName(g: Group): string {
    return this.personName({ email: '', name: g.leader.name, last_name: g.leader.last_name });
  }

  toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  // ─── crear ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  createResponsablesGroup(): void {
    if (!this.canCreateResponsablesGroup()) return;
    this.create({ name: this.responsablesGroupName().trim() }, () => this.responsablesGroupName.set(''));
  }

  createTeam(): void {
    if (!this.canCreateTeam()) return;
    this.create({ name: this.teamName().trim(), leader_id: this.teamLeaderId() }, () => {
      this.teamName.set('');
      this.teamLeaderId.set('');
    });
  }

  /** El responsable crea su equipo: no manda `leader_id` (es él). */
  createOwnTeam(): void {
    if (!this.canCreateOwnTeam()) return;
    this.create({ name: this.ownTeamName().trim() }, () => this.ownTeamName.set(''));
  }

  private create(dto: CreateGroupDto, done: () => void): void {
    this.saving.set(true);
    this.reset();
    this.groupApi.create(dto).subscribe({
      next: (group) => {
        this.saving.set(false);
        done();
        this.notice.set(this.translate.instant('TEAM.GROUPS.NOTICE.CREATED', { name: group.name }));
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }

  // ─── renombrar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  startRename(g: Group): void {
    this.reset();
    this.renamingId.set(g.id);
    this.renameDraft.set(g.name);
  }

  cancelRename(): void {
    this.renamingId.set(null);
  }

  saveRename(): void {
    const id = this.renamingId();
    if (!id || !this.canRename()) return;
    this.saving.set(true);
    this.reset();
    this.groupApi.rename(id, this.renameDraft().trim()).subscribe({
      next: (group) => {
        this.saving.set(false);
        this.renamingId.set(null);
        this.notice.set(this.translate.instant('TEAM.GROUPS.NOTICE.RENAMED', { name: group.name }));
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }

  onMoved(): void {
    this.changed.emit();
  }

  /** `message` ya viene traducido por el backend (409: nombre repetido o reservado, el responsable ya tiene equipo; 403; 404). */
  private fail(e: unknown): void {
    this.saving.set(false);
    this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
