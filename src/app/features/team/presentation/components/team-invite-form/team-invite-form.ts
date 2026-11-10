import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { Group } from '../../../domain/models/group.models';
import { InviteDto, InvitedMember, TeamActor, TeamMember, TeamRole } from '../../../domain/models/team.models';
import { GroupService } from '../../../domain/services/group.service';
import { TeamService } from '../../../domain/services/team.service';

export type InviteActor = TeamActor;

// Quién puede crear a quién (D102, punto 2): el administrador crea todo el esquema; un responsable solo crea delegados, de su propio equipo; un delegado no crea a nadie.
// Es una regla de permisos, no una lista de opciones del catálogo; el backend la vuelve a comprobar (403).
const CREATABLE: Record<InviteActor, readonly TeamRole[]> = {
  admin_empresa: ['responsable', 'delegado', 'auditor', 'admin_empresa'],
  responsable: ['delegado'],
};

// Dar de alta a una persona del equipo (MD-197, contracts/gestion-usuarios.md → «POST /v1/users»). La cuenta nace «pendiente» y la invitación con su código sale por correo:
// aquí solo se avisa si el correo salió. Un delegado necesita un equipo (D104): el administrador elige con qué responsable trabaja (por dentro, el equipo de ese responsable); el responsable usa el suyo.
// Al crear a un responsable se crea también su equipo (D104: lo crea el administrador por él), con el nombre que se escriba o «Equipo de <nombre>»: así nadie tiene que crear grupos aparte.
@Component({
  selector: 'app-team-invite-form',
  imports: [TranslatePipe],
  templateUrl: './team-invite-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamInviteForm {
  private readonly api = inject(TeamService);
  private readonly groupApi = inject(GroupService);
  private readonly translate = inject(TranslateService);

  readonly actor = input.required<InviteActor>();
  /** Los grupos que ve quien crea: todos si es administrador; el suyo si es responsable (vacío mientras no lo cree). */
  readonly groups = input<Group[]>([]);
  /** Los grupos llegan aparte: hasta que llegan no se puede decir que «no hay equipo» ni dejar crear un delegado. */
  readonly groupsLoaded = input(true);
  /** El equipo ya cargado, para avisar antes de enviar si el correo ya está en él. */
  readonly members = input<TeamMember[]>([]);

  /** La persona se creó (con o sin correo enviado). */
  readonly invited = output<InvitedMember>();
  /** El correo ya es de alguien del equipo y se pidió corregir su nombre en vez de crearlo otra vez. */
  readonly fixName = output<TeamMember>();
  /** Un delegado necesita un equipo que aún no existe: se pidió ir a crearlo en la pestaña de grupos. */
  readonly manageGroups = output<void>();
  /** La persona se creó pero su equipo no (el nombre ya existe, un corte…): quien muestra la pantalla lo dice y deja crearlo desde el organigrama. Trae el motivo si el servidor lo dio. */
  readonly teamFailed = output<string | null>();
  /** El equipo del responsable ya existe: la pantalla vuelve a pedir los grupos. */
  readonly teamCreated = output<void>();

  readonly email = signal('');
  readonly name = signal('');
  readonly lastName = signal('');
  private readonly chosenRole = signal<TeamRole | null>(null);
  /** `null` = sin elegir: para un delegado es obligatorio. */
  readonly isInternal = signal<boolean | null>(null);
  readonly groupId = signal('');
  /** Solo al crear un responsable: cómo se llamará su equipo. Vacío = «Equipo de <su nombre>». */
  readonly teamName = signal('');
  readonly saving = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly roleOptions = computed(() => CREATABLE[this.actor()]);
  readonly role = computed<TeamRole>(() => {
    const chosen = this.chosenRole();
    return chosen && this.roleOptions().includes(chosen) ? chosen : this.roleOptions()[0];
  });

  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));
  /** Para pedir el nombre del equipo: el administrador, al crear a un responsable. */
  readonly showTeamName = computed(() => this.actor() === 'admin_empresa' && this.role() === 'responsable');
  readonly showTeamPick = computed(() => this.actor() === 'admin_empresa' && this.role() === 'delegado' && this.teams().length > 0);
  /** Un delegado no existe sin equipo (D104): sin equipo al que añadirlo, no se puede crear. */
  readonly noTeam = computed(() => this.groupsLoaded() && this.role() === 'delegado' && this.teams().length === 0);

  /** El correo identifica a la persona: si ya está en el equipo se avisa antes de intentar crear nada. Si es de otra empresa, lo dice el servidor al enviar (409). */
  readonly existing = computed(() => {
    const email = this.email().trim().toLowerCase();
    return email ? (this.members().find((m) => m.email.toLowerCase() === email) ?? null) : null;
  });

  readonly canSubmit = computed(
    () =>
      /^\S+@\S+\.\S+$/.test(this.email().trim()) &&
      !!this.name().trim() &&
      !!this.lastName().trim() &&
      !this.existing() &&
      !this.saving() &&
      (this.role() !== 'delegado' || (this.groupsLoaded() && this.isInternal() !== null && !this.noTeam() && (this.actor() === 'responsable' || !!this.groupId()))),
  );

  setRole(role: string): void {
    this.chosenRole.set(role as TeamRole);
    this.isInternal.set(null);
    this.groupId.set('');
    this.teamName.set('');
    this.error.set(null);
  }

  setEmail(value: string): void {
    this.email.set(value);
    this.emailError.set(null);
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  leaderName(group: Group): string {
    return this.personName({ email: '', name: group.leader.name, last_name: group.leader.last_name });
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const role = this.role();
    const body: InviteDto = { email: this.email().trim(), name: this.name().trim(), last_name: this.lastName().trim(), role };
    if (role === 'delegado') {
      body.is_internal = this.isInternal() as boolean;
      if (this.actor() === 'admin_empresa') body.group_id = this.groupId();
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.invite(body).subscribe({
      next: (created) => {
        const teamRequest = role === 'responsable' && this.actor() === 'admin_empresa' ? { person: this.personName(created), email: created.email, typed: this.teamName().trim() } : null;
        this.saving.set(false);
        this.email.set('');
        this.name.set('');
        this.lastName.set('');
        this.isInternal.set(null);
        this.groupId.set('');
        this.teamName.set('');
        this.invited.emit(created);
        if (teamRequest) this.createTeamFor(created.id, teamRequest);
      },
      error: (e) => {
        this.saving.set(false);
        this.fail(e);
      },
    });
  }

  /** El equipo del responsable recién creado. Si el nombre por omisión ya lo usa otro equipo, se vuelve a intentar con el correo al final; si fue un nombre escrito a mano, se avisa. */
  private createTeamFor(leaderId: string, req: { person: string; email: string; typed: string }): void {
    const base = req.typed || this.translate.instant('TEAM.ORG.DEFAULT_TEAM_NAME', { name: req.person });
    this.groupApi.create({ name: base.slice(0, 100), leader_id: leaderId }).subscribe({
      next: () => this.teamCreated.emit(),
      error: (e) => {
        if (!req.typed && apiErrorCode(e) === 'GROUP_NAME_TAKEN') {
          this.groupApi.create({ name: `${base} (${req.email})`.slice(0, 100), leader_id: leaderId }).subscribe({
            next: () => this.teamCreated.emit(),
            error: (e2) => this.teamFailed.emit(apiErrorMessage(e2, '') || null),
          });
          return;
        }
        this.teamFailed.emit(apiErrorMessage(e, '') || null);
      },
    });
  }

  /** El correo ya es de alguien del equipo: en vez de crearlo otra vez, se le corrige el nombre. */
  fixExisting(): void {
    const member = this.existing();
    if (!member) return;
    this.email.set('');
    this.fixName.emit(member);
  }

  private fail(e: unknown): void {
    switch (apiErrorCode(e)) {
      // Un correo que ya existe en la plataforma se dice bajo el campo del correo, no en un aviso general.
      case 'EMAIL_TAKEN':
        this.emailError.set(apiErrorMessage(e, this.translate.instant('TEAM.INVITE.EMAIL_TAKEN')));
        return;
      case 'USER_LIMIT_REACHED': {
        const data = apiErrorData(e);
        const counted = typeof data['max_users'] === 'number' && typeof data['users_count'] === 'number';
        this.error.set(this.translate.instant(counted ? 'TEAM.ERROR.USER_LIMIT_COUNTS' : 'TEAM.ERROR.USER_LIMIT', { count: data['users_count'], max: data['max_users'] }));
        return;
      }
      case 'RESPONSIBLE_HAS_NO_TEAM':
        this.error.set(this.translate.instant('TEAM.ERROR.NO_TEAM'));
        return;
      // `message` ya viene traducido por el backend (409, 422).
      default:
        this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
    }
  }
}
