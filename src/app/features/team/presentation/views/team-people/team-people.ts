import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { PageInfo } from '@shared/presentation/components/data-table/table-page';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { Field } from '@shared/presentation/components/field/field';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { Group } from '@features/team/domain/models/group.models';
import { Invitation, InvitedMember, TeamFilters, TeamMember, TeamRole, TeamStatus } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { InviteActor, TeamInviteForm } from '../../components/team-invite-form/team-invite-form';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

type Stage = 'loading' | 'error' | 'ready';
interface Pending { kind: 'deactivate' | 'reset_mfa'; member: TeamMember }
type Affiliation = '' | 'internal' | 'external';

// La última invitación mandada: se queda a la vista hasta que se cierra. Si el correo falló (`failed`) la cuenta existe y se ofrece reenviarla. El código nunca llega aquí:
// el Backend lo manda por correo a la persona (MD-190) y la respuesta solo dice si salió.
interface SentInvitation { id: string; email: string; status: 'sent' | 'failed'; expiresAt: string }

const PAGE_SIZE = 25;

// Los valores de `user_role` y `user_status` (contracts/enums); sus etiquetas salen de i18n. No hay catálogo en la API para estos dos enums. El filtro de estado del Backend
// hoy acepta `active`, `inactive` y `pending` (no `suspended`).
const ADMIN_ROLE: TeamRole = 'admin_empresa';
const ROLE_FILTERS: readonly TeamRole[] = ['admin_empresa', 'responsable', 'delegado', 'auditor'];
const STATUS_FILTERS: readonly TeamStatus[] = ['active', 'pending', 'inactive'];

// El equipo de la empresa (MD-197, D96, D102, D104). El administrador crea y gestiona a todos (responsables, delegados, auditores y otros administradores); el responsable ve a su equipo y
// crea delegados para él. La invitación sale por correo (MD-190) y esta pantalla solo informa el resultado. Se retiraron el reparto por servicio y dimensión y las especialidades (MD-206).
// Personas es una subpágina del grupo Equipo (`/equipo/personas`); los grupos (MD-198) tienen la suya (`/equipo/grupos`, `TeamGroupsView`). La lista es una tabla de filas activables: la fila (o su
// flecha) abre un panel lateral de solo lectura con los datos que ya trae la lista y las acciones que ya existen (no hay endpoint de detalle de persona).
// Falta (espera al Backend): la baja con aviso de controles asignados y corregir si un delegado es interno o externo (ambos en MD-191, aún fuera de develop).
@Component({
  selector: 'app-team-people',
  imports: [Badge, PageHeader, TranslatePipe, ConfirmDialog, LocalDatePipe, DataTable, TableCell, TeamInviteForm, EmptyState, Field, FormModal, StatusIndicator, PersonCell, TableToolbar, TableFilter, Busy, BusyFields],
  templateUrl: './team-people.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPeopleView implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly router = inject(Router);
  private readonly api = inject(TeamService);
  private readonly groupApi = inject(GroupService);
  private readonly translate = inject(TranslateService);
  private readonly session = inject(SessionService);
  readonly myId = computed(() => this.session.user()?.id);

  /** Solo el administrador cambia a las personas del equipo (la API responde 403 al resto); el responsable ve a su equipo y crea delegados. */
  readonly canManage = computed(() => isCompanyAdmin(this.session.user()?.role));
  readonly actor = computed<InviteActor>(() => (this.canManage() ? 'admin_empresa' : 'responsable'));

  readonly roleOptions: TableFilterOption[] = ROLE_FILTERS.map((r) => ({ value: r, labelKey: 'TEAM.ROLE.' + r.toUpperCase() }));
  readonly statusOptions: TableFilterOption[] = STATUS_FILTERS.map((s) => ({ value: s, labelKey: 'TEAM.STATUS.' + s.toUpperCase() }));
  readonly affiliationOptions: TableFilterOption[] = [
    { value: 'internal', labelKey: 'TEAM.INVITE.INTERNAL' },
    { value: 'external', labelKey: 'TEAM.INVITE.EXTERNAL' },
  ];
  readonly groupOptions = computed<TableFilterOption[]>(() => this.groups().map((g) => ({ value: g.id, label: g.name })));

  readonly stage = signal<Stage>('loading');
  /** El formulario de invitación vive en un drawer que abre «Invitar». */
  readonly inviteOpen = signal(false);
  private readonly inviteForm = viewChild(TeamInviteForm);
  /** Con datos escritos sin enviar, Esc y el fondo no descartan el formulario (Cancelar sí); mientras se envía, nada lo cierra. */
  readonly inviteDirty = computed(() => this.inviteForm()?.dirty() ?? false);
  readonly inviteSaving = computed(() => this.inviteForm()?.saving() ?? false);
  readonly inviteCanSubmit = computed(() => this.inviteForm()?.canSubmit() ?? false);
  readonly loadingPage = signal(false);
  readonly members = signal<TeamMember[]>([]);
  readonly groups = signal<Group[]>([]);
  /** Los grupos llegan aparte de las personas: hasta que llegan (o fallan), no se puede decir que «no hay equipo». */
  readonly groupsLoaded = signal(false);
  readonly page = signal<PageInfo | null>(null);
  private readonly pageNumber = signal(1);
  private readonly pageSize = signal(PAGE_SIZE);
  // Cada petición de la lista lleva su número: si una respuesta lenta llega después de otra más nueva (filtros que cambian rápido), se descarta.
  private requestSeq = 0;

  readonly roleFilter = signal<TeamRole | ''>('');
  readonly statusFilter = signal<TeamStatus | ''>('');
  readonly groupFilter = signal('');
  readonly affiliationFilter = signal<Affiliation>('');
  readonly hasFilters = computed(() => !!(this.roleFilter() || this.statusFilter() || this.groupFilter() || this.affiliationFilter()));

  readonly saving = signal(false);
  // Cuál acción lanzada con un botón corre: solo ese botón muestra el ocupado; los demás quedan deshabilitados.
  readonly busyAction = signal<'resend' | 'reactivate' | null>(null);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly invitation = signal<SentInvitation | null>(null);

  // Corregir el nombre de alguien del equipo
  readonly nameEditing = signal<string | null>(null);
  readonly nameDraft = signal('');
  readonly lastNameDraft = signal('');
  readonly canSaveName = computed(() => !!this.nameDraft().trim() && !!this.lastNameDraft().trim());

  // Confirmaciones (desactivar, quitar el segundo factor)
  readonly confirming = signal<Pending | null>(null);

  /** La persona cuyo detalle está abierto (por su id: si la lista se vuelve a pedir, el panel muestra los datos nuevos). */
  readonly detailId = signal<string | null>(null);
  readonly detail = computed(() => this.members().find((m) => m.id === this.detailId()) ?? null);

  /** «Interno o externo» solo existe para un delegado: la columna aparece si la página trae alguno. */
  readonly columns = computed<TableColumn<TeamMember>[]>(() => [
    { key: 'person', headerKey: 'TEAM.COLUMNS.PERSON', skeleton: 'person' },
    { key: 'role', headerKey: 'TEAM.COLUMNS.ROLE', skeleton: 'badge' },
    { key: 'status', headerKey: 'TEAM.COLUMNS.STATUS', skeleton: 'badge' },
    { key: 'group', headerKey: 'TEAM.COLUMNS.GROUP' },
    ...(this.members().some((m) => m.is_internal !== null && m.is_internal !== undefined) ? [{ key: 'affiliation', headerKey: 'TEAM.COLUMNS.AFFILIATION' }] : []),
    { key: 'lastLogin', headerKey: 'TEAM.COLUMNS.LAST_LOGIN' },
  ]);
  readonly rowKey = (m: TeamMember) => m.id;

  ngOnInit(): void {
    this.reloadGroups();
    this.load(true);
  }

  private reloadGroups(): void {
    this.groupApi.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.groupsLoaded.set(true);
      },
      error: () => {
        this.groups.set([]);
        this.groupsLoaded.set(true);
      },
    });
  }

  /** Se creó o renombró un equipo, o se movió a un delegado: los grupos (y quién está en cada uno) cambiaron. */
  onGroupsChanged(): void {
    this.reloadGroups();
    this.refresh();
  }

  /** Pide la página actual con los filtros de ahora. La primera vez (o al reintentar) ocupa la pantalla; después solo la tabla. */
  load(initial = false): void {
    const seq = ++this.requestSeq;
    if (initial) this.stage.set('loading');
    else this.loadingPage.set(true);
    this.api.list(this.filters(), this.pageNumber(), this.pageSize()).subscribe({
      next: (data) => {
        if (seq !== this.requestSeq) return;
        this.members.set(data.items);
        this.page.set({ page: data.page, pageSize: data.page_size, total: data.total, totalPages: data.total_pages });
        this.stage.set('ready');
        this.loadingPage.set(false);
      },
      error: () => {
        if (seq !== this.requestSeq) return;
        this.loadingPage.set(false);
        if (initial) this.stage.set('error');
        else this.error.set(this.translate.instant('TEAM.LOAD_ERROR'));
      },
    });
  }

  private filters(): TeamFilters {
    const affiliation = this.affiliationFilter();
    return {
      role: this.roleFilter() || null,
      status: this.statusFilter() || null,
      groupId: this.groupFilter() || null,
      isInternal: affiliation === '' ? null : affiliation === 'internal',
    };
  }

  /** An active person with a second factor can have it reset, except the company admin (it is not reset from here). */
  canResetMfa(m: TeamMember): boolean {
    return !!m.is_mfa_enabled && m.role !== ADMIN_ROLE;
  }

  isMe(m: TeamMember): boolean {
    return m.id === this.myId();
  }

  // ─── filtros y páginas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  setFilter(kind: 'role' | 'status' | 'group' | 'affiliation', value: string): void {
    if (kind === 'role') this.roleFilter.set(value as TeamRole | '');
    else if (kind === 'status') this.statusFilter.set(value as TeamStatus | '');
    else if (kind === 'group') this.groupFilter.set(value);
    else this.affiliationFilter.set(value as Affiliation);
    this.pageNumber.set(1);
    this.load();
  }

  clearFilters(): void {
    this.roleFilter.set('');
    this.statusFilter.set('');
    this.groupFilter.set('');
    this.affiliationFilter.set('');
    this.pageNumber.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  resize(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  /** Tono del estado de una persona: activa (ok), invitación pendiente (aviso), el resto (neutro). */
  statusTone(status: string): StatusTone {
    return status === 'active' ? 'ok' : status === 'pending' ? 'warn' : 'neutral';
  }

  // ─── invitar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  openInvite(): void {
    this.inviteOpen.set(true);
  }

  /** El correo ya es de alguien del equipo: se cierra el drawer y se corrige su nombre en el detalle de esa persona. */
  onFixName(member: TeamMember): void {
    this.inviteOpen.set(false);
    this.detailId.set(member.id);
    this.startNameEdit(member);
  }

  openDetail(member: TeamMember): void {
    this.resetMessages();
    this.nameEditing.set(null);
    this.detailId.set(member.id);
  }

  closeDetail(): void {
    this.detailId.set(null);
    this.nameEditing.set(null);
  }

  /** Un delegado necesita un equipo que aún no existe: se cierra el drawer y se va a la página de grupos. */
  onManageGroups(): void {
    this.inviteOpen.set(false);
    void this.router.navigate(['/equipo/organigrama']);
  }

  /** El alta ya se hizo: se cierra el drawer, se informa si el correo salió y se vuelve a pedir la lista. */
  onInvited(created: InvitedMember): void {
    this.inviteOpen.set(false);
    this.resetMessages();
    this.showInvitation(created.id, created.email, created.invitation);
    this.notice.set(this.translate.instant('TEAM.NOTICE.INVITED'));
    this.refresh();
  }

  /** El responsable recién creado ya tiene su equipo: los grupos cambiaron. */
  onTeamCreated(): void {
    this.reloadGroups();
  }

  /** La persona se creó pero su equipo no: se dice y se deja crearlo desde Grupos. `reason` es lo que dijo el servidor (ya traducido), si dijo algo. */
  onTeamFailed(reason: string | null): void {
    this.error.set([this.translate.instant('TEAM.ERROR.TEAM_NOT_CREATED'), reason].filter(Boolean).join(' '));
    this.reloadGroups();
  }

  /** Reenvía la invitación (código nuevo por correo; el anterior deja de servir). Sirve para una cuenta `pending`, también cuando el primer envío falló. */
  resend(id: string, email: string): void {
    if (this.saving()) return;
    this.busyAction.set('resend');
    this.run(this.api.resendInvitation(id), 'TEAM.NOTICE.CODE_REISSUED', (invitation) => this.showInvitation(id, email, invitation));
  }

  dismissInvitation(): void {
    this.invitation.set(null);
  }

  private showInvitation(id: string, email: string, invitation: Invitation): void {
    this.invitation.set({ id, email, status: invitation.delivery_status === 'failed' ? 'failed' : 'sent', expiresAt: invitation.expires_at });
  }

  // ─── nombre ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  startNameEdit(m: TeamMember): void {
    this.resetMessages();
    this.nameEditing.set(m.id);
    this.nameDraft.set(m.name ?? '');
    this.lastNameDraft.set(m.last_name ?? '');
  }

  saveName(): void {
    if (this.saving()) return;
    const id = this.nameEditing();
    if (!id || !this.canSaveName()) return;
    this.run(this.api.update(id, { name: this.nameDraft().trim(), last_name: this.lastNameDraft().trim() }), 'TEAM.NOTICE.NAME_SAVED', () => this.nameEditing.set(null));
  }

  // ─── estado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  reactivate(m: TeamMember): void {
    if (this.saving()) return;
    this.busyAction.set('reactivate');
    this.run(this.api.update(m.id, { status: 'active' }), 'TEAM.NOTICE.REACTIVATED', () => undefined);
  }

  ask(kind: Pending['kind'], member: TeamMember): void {
    this.resetMessages();
    this.confirming.set({ kind, member });
  }

  confirm(): void {
    const pending = this.confirming();
    if (!pending) return;
    const call: Observable<unknown> = pending.kind === 'deactivate' ? this.api.update(pending.member.id, { status: 'inactive' }) : this.api.resetMfa(pending.member.id);
    this.run(call, pending.kind === 'deactivate' ? 'TEAM.NOTICE.DEACTIVATED' : 'TEAM.NOTICE.MFA_RESET', () => this.confirming.set(null), () => this.confirming.set(null));
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  // ─── común ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  private run<T>(call: Observable<T>, noticeKey: string, done: (result: T) => void, failed?: () => void): void {
    this.saving.set(true);
    this.resetMessages();
    call.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.busyAction.set(null);
        done(result);
        this.notice.set(this.translate.instant(noticeKey));
        this.refresh();
      },
      // `message` ya viene traducido por el backend (409: no activada, es el último administrador; 422: campos).
      error: (e) => {
        this.saving.set(false);
        this.busyAction.set(null);
        failed?.();
        this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
      },
    });
  }

  /** Vuelve a pedir la página actual sin tapar la tabla con el cargador completo. */
  private refresh(): void {
    const seq = ++this.requestSeq;
    this.api.list(this.filters(), this.pageNumber(), this.pageSize()).subscribe({
      next: (data) => {
        if (seq !== this.requestSeq) return;
        this.members.set(data.items);
        this.page.set({ page: data.page, pageSize: data.page_size, total: data.total, totalPages: data.total_pages });
        // Si esta respuesta reemplazó a la de una carga que aún estaba en vuelo, la pantalla no se queda esperándola.
        this.stage.set('ready');
        this.loadingPage.set(false);
      },
    });
  }

  private resetMessages(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
