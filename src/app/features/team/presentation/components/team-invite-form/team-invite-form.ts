import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Field } from '@shared/presentation/components/field/field';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { Group } from '@features/team/domain/models/group.models';
import { InviteDto, InvitedMember, TeamActor, TeamMember, TeamRole } from '@shared/domain/models/team.models';
import { TeamService } from '@shared/domain/services/team.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { targetValue } from '@shared/presentation/utils/event-target';

export type InviteActor = TeamActor;

// Quién puede crear a quién (D102, punto 2): el administrador crea todo el esquema; un responsable solo crea delegados, de su propio equipo; un delegado no crea a nadie.
// Es una regla de permisos, no una lista de opciones del catálogo; el backend la vuelve a comprobar (403).
const CREATABLE: Record<InviteActor, readonly TeamRole[]> = {
  admin_empresa: ['responsable', 'delegado', 'auditor', 'admin_empresa'],
  responsable: ['delegado'],
};

// Dar de alta a una persona del equipo (MD-197, contracts/gestion-usuarios.md → «POST /v1/users»). La cuenta nace «pendiente» y la invitación con su código sale por correo:
// aquí solo se avisa si el correo salió. Un delegado necesita un equipo (D104): el administrador elige el de un responsable; el responsable usa el suyo.
@Component({
  selector: 'app-team-invite-form',
  imports: [TranslatePipe, Field],
  templateUrl: './team-invite-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamInviteForm {
  protected readonly targetValue = targetValue;
  private readonly api = inject(TeamService);
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

  readonly email = signal('');
  readonly name = signal('');
  readonly lastName = signal('');
  private readonly chosenRole = signal<TeamRole | null>(null);
  /** `null` = sin elegir: para un delegado es obligatorio. */
  readonly isInternal = signal<boolean | null>(null);
  readonly groupId = signal('');
  readonly saving = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** Hay algo escrito o elegido sin enviar: quien aloja el formulario no debe descartarlo con Esc ni con un clic fuera. */
  readonly dirty = computed(
    () => !!(this.email().trim() || this.name().trim() || this.lastName().trim() || this.chosenRole() || this.isInternal() !== null || this.groupId()),
  );

  readonly roleOptions = computed(() => CREATABLE[this.actor()]);
  readonly isAdminActor = computed(() => isCompanyAdmin(this.actor()));
  readonly role = computed<TeamRole>(() => {
    const chosen = this.chosenRole();
    return chosen && this.roleOptions().includes(chosen) ? chosen : this.roleOptions()[0];
  });

  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));
  private readonly responsablesGroups = computed(() => this.groups().filter((g) => g.kind === 'responsables'));
  /** El grupo de responsables solo se pregunta cuando hay más de uno: con uno solo, el de siempre («Responsables»), no hay nada que elegir. */
  readonly showResponsablesGroup = computed(() => isCompanyAdmin(this.actor()) && this.role() === 'responsable' && this.responsablesGroups().length > 1);
  readonly responsablesGroupOptions = this.responsablesGroups;
  readonly showTeamPick = computed(() => isCompanyAdmin(this.actor()) && this.role() === 'delegado' && this.teams().length > 0);
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
      !this.saving() &&
      (this.role() !== 'delegado' || (this.groupsLoaded() && this.isInternal() !== null && !this.noTeam() && (this.actor() === 'responsable' || !!this.groupId()))),
  );

  setRole(role: string): void {
    this.chosenRole.set(role as TeamRole);
    this.isInternal.set(null);
    this.groupId.set('');
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
      if (isCompanyAdmin(this.actor())) body.group_id = this.groupId();
    } else if (this.showResponsablesGroup() && this.groupId()) {
      body.group_id = this.groupId();
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.invite(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.email.set('');
        this.name.set('');
        this.lastName.set('');
        this.isInternal.set(null);
        this.groupId.set('');
        this.invited.emit(created);
      },
      error: (e) => {
        this.saving.set(false);
        this.fail(e);
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
