import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { PageInfo } from '@shared/domain/utils/pagination';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { Group } from '../../../domain/models/group.models';
import { Invitation, InvitedMember, TeamFilters, TeamMember, TeamRole, TeamStatus } from '../../../domain/models/team.models';
import { GroupService } from '../../../domain/services/group.service';
import { TeamService } from '../../../domain/services/team.service';
import { InviteActor, TeamInviteForm } from '../../components/team-invite-form/team-invite-form';
import { TeamGroups } from '../../components/team-groups/team-groups';

type Stage = 'loading' | 'error' | 'ready';
type Tab = 'people' | 'groups';
type Pending = { kind: 'deactivate' | 'reset_mfa'; member: TeamMember };
type Affiliation = '' | 'internal' | 'external';

// La última invitación mandada: se queda a la vista hasta que se cierra. Si el correo falló (`failed`) la cuenta existe y se ofrece reenviarla. El código nunca llega aquí:
// el Backend lo manda por correo a la persona (MD-190) y la respuesta solo dice si salió.
type SentInvitation = { id: string; email: string; status: 'sent' | 'failed'; expiresAt: string };

const PAGE_SIZE = 25;

// Los valores de `user_role` y `user_status` (contracts/enums); sus etiquetas salen de i18n. No hay catálogo en la API para estos dos enums. El filtro de estado del Backend
// hoy acepta `active`, `inactive` y `pending` (no `suspended`).
const ROLE_FILTERS: readonly TeamRole[] = ['admin_empresa', 'responsable', 'delegado', 'auditor'];
const STATUS_FILTERS: readonly TeamStatus[] = ['active', 'pending', 'inactive'];

// El equipo de la empresa (MD-197, D96, D102, D104). El administrador crea y gestiona a todos (responsables, delegados, auditores y otros administradores); el responsable ve a su equipo y
// crea delegados para él. La invitación sale por correo (MD-190) y esta pantalla solo informa el resultado. Se retiraron el reparto por servicio y dimensión y las especialidades (MD-206).
// Los grupos (crear, renombrar, ver sus personas y mover delegados, MD-198) viven en su pestaña, en `TeamGroups`.
// Falta (espera al Backend): la baja con aviso de controles asignados y corregir si un delegado es interno o externo (ambos en MD-191, aún fuera de develop).
@Component({
  selector: 'app-team',
  imports: [PageHeader, TranslatePipe, ConfirmDialog, LoadingSpinner, DatePipe, DataTable, TableCell, TeamInviteForm, TeamGroups],
  templateUrl: './team.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamView implements OnInit {
  private readonly api = inject(TeamService);
  private readonly groupApi = inject(GroupService);
  private readonly translate = inject(TranslateService);
  private readonly session = inject(SessionService);
  readonly myId = computed(() => this.session.user()?.id);

  /** Solo el administrador cambia a las personas del equipo (la API responde 403 al resto); el responsable ve a su equipo y crea delegados. */
  readonly canManage = computed(() => this.session.user()?.role === 'admin_empresa');
  readonly actor = computed<InviteActor>(() => (this.canManage() ? 'admin_empresa' : 'responsable'));

  readonly roleFilters = ROLE_FILTERS;
  readonly statusFilters = STATUS_FILTERS;

  readonly stage = signal<Stage>('loading');
  readonly tab = signal<Tab>('people');
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
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly invitation = signal<SentInvitation | null>(null);

  // Corregir el nombre de alguien del equipo
  readonly nameEditing = signal<string | null>(null);
  readonly nameDraft = signal('');
  readonly lastNameDraft = signal('');
  readonly canSaveName = computed(() => !!this.nameDraft().trim() && !!this.lastNameDraft().trim() && !this.saving());

  // Confirmaciones (desactivar, quitar el segundo factor)
  readonly confirming = signal<Pending | null>(null);

  readonly columns = computed<TableColumn<TeamMember>[]>(() => [
    { key: 'person', headerKey: 'TEAM.COLUMNS.PERSON' },
    { key: 'role', headerKey: 'TEAM.COLUMNS.ROLE' },
    { key: 'status', headerKey: 'TEAM.COLUMNS.STATUS' },
    { key: 'group', headerKey: 'TEAM.COLUMNS.GROUP' },
    { key: 'lastLogin', headerKey: 'TEAM.COLUMNS.LAST_LOGIN' },
    ...(this.canManage() ? [{ key: 'actions', headerKey: 'TEAM.COLUMNS.ACTIONS', align: 'right' as const, srOnlyHeader: true }] : []),
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

  /** Se creó o renombró un grupo, o se movió a un delegado: los grupos (y quién está en cada uno) cambiaron. */
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

  // ─── invitar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** El alta ya se hizo: se informa si el correo salió y se vuelve a pedir la lista. */
  onInvited(created: InvitedMember): void {
    this.resetMessages();
    this.showInvitation(created.id, created.email, created.invitation);
    this.notice.set(this.translate.instant('TEAM.NOTICE.INVITED'));
    this.refresh();
  }

  /** Reenvía la invitación (código nuevo por correo; el anterior deja de servir). Sirve para una cuenta `pending`, también cuando el primer envío falló. */
  resend(id: string, email: string): void {
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
    const id = this.nameEditing();
    if (!id || !this.canSaveName()) return;
    this.run(this.api.update(id, { name: this.nameDraft().trim(), last_name: this.lastNameDraft().trim() }), 'TEAM.NOTICE.NAME_SAVED', () => this.nameEditing.set(null));
  }

  // ─── estado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  reactivate(m: TeamMember): void {
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
        done(result);
        this.notice.set(this.translate.instant(noticeKey));
        this.refresh();
      },
      // `message` ya viene traducido por el backend (409: no activada, es el último administrador; 422: campos).
      error: (e) => {
        this.saving.set(false);
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
