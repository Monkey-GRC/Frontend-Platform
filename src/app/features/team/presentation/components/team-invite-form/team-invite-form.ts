import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Field } from '@shared/presentation/components/field/field';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { Group } from '@features/team/domain/models/group.models';
import { InviteDto, InvitedMember, TeamMember, TeamRole } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Select, SelectOption } from '@shared/presentation/components/select/select';

// Quién puede crear a quién (D136, MD-503): solo el administrador de la empresa crea a la gente del equipo, de cualquier rol; el responsable ya no crea ni a sus delegados. El colaborador
// no lleva equipo ni es interno o externo: solo se le da de alta. Es una regla de permisos, no una lista de opciones del catálogo; el backend la vuelve a comprobar (403).
const CREATABLE: readonly TeamRole[] = ['responsable', 'delegado', 'auditor', 'colaborador', 'admin_empresa'];

// Dar de alta a una persona del equipo (MD-197, contracts/gestion-usuarios.md → «POST /v1/users»). La cuenta nace «pendiente» y la invitación con su código sale por correo:
// aquí solo se avisa si el correo salió. Un delegado necesita un equipo (D104): el administrador elige con qué responsable trabaja (por dentro, el equipo de ese responsable).
// Al crear a un responsable se crea también su equipo (D104: lo crea el administrador por él), con el nombre que se escriba o «Equipo de <nombre>»: así nadie tiene que crear grupos aparte.
@Component({
  selector: 'app-team-invite-form',
  imports: [TranslatePipe, Field, Select],
  templateUrl: './team-invite-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamInviteForm {
  protected readonly targetValue = targetValue;
  private readonly api = inject(TeamService);
  private readonly groupApi = inject(GroupService);
  private readonly translate = inject(TranslateService);

  /** Los grupos de la empresa, para elegir el equipo de un delegado. */
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

  /** Hay algo escrito o elegido sin enviar: quien aloja el formulario no debe descartarlo con Esc ni con un clic fuera. */
  readonly dirty = computed(
    () => !!(this.email().trim() || this.name().trim() || this.lastName().trim() || this.chosenRole() || this.isInternal() !== null || this.groupId() || this.teamName().trim()),
  );

  readonly roleOptions = CREATABLE;
  readonly role = computed<TeamRole>(() => {
    const chosen = this.chosenRole();
    return chosen && this.roleOptions.includes(chosen) ? chosen : this.roleOptions[0];
  });

  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));
  readonly roleSelectOptions = computed<SelectOption[]>(() => this.roleOptions.map((r) => ({ value: r, labelKey: 'TEAM.ROLE.' + r.toUpperCase() })));
  readonly teamSelectOptions = computed<SelectOption[]>(() => this.teams().map((g) => ({ value: g.id, labelKey: 'TEAM.INVITE.TEAM_OPTION', labelParams: { team: g.name, leader: this.leaderName(g) } })));
  /** Para pedir el nombre del equipo: al crear a un responsable. */
  readonly showTeamName = computed(() => this.role() === 'responsable');
  readonly showTeamPick = computed(() => this.role() === 'delegado' && this.teams().length > 0);
  /** Un delegado no existe sin equipo (D104): sin equipo al que añadirlo, no se puede crear. */
  readonly isDelegateRole = computed(() => this.role() === 'delegado');
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
      (this.role() !== 'delegado' || (this.groupsLoaded() && this.isInternal() !== null && !this.noTeam() && !!this.groupId())),
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
    if (!this.canSubmit() || this.saving()) return;
    const role = this.role();
    const body: InviteDto = { email: this.email().trim(), name: this.name().trim(), last_name: this.lastName().trim(), role };
    if (role === 'delegado') {
      body.is_internal = this.isInternal() as boolean;
      body.group_id = this.groupId();
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.invite(body).subscribe({
      next: (created) => {
        const teamRequest = role === 'responsable' ? { person: this.personName(created), email: created.email, typed: this.teamName().trim() } : null;
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
