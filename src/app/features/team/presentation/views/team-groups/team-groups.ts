import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Field } from '@shared/presentation/components/field/field';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { CreateGroupDto, Group, GroupKind } from '@features/team/domain/models/group.models';
import { TeamMember } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { GroupMembers } from '../../components/group-members/group-members';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Busy } from '@shared/presentation/directives/busy';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const MAX_NAME = 100;

// Los grupos de la empresa, subpágina `/equipo/grupos` del grupo Equipo (MD-198, contracts/gestion-usuarios.md → «Grupos», D102, D104). Un grupo tiene un nombre y un líder; cada persona (salvo administrador y auditor) pertenece a uno.
//  · El administrador lidera uno o varios grupos de responsables, crea el equipo de delegados de cualquier responsable y renombra los grupos.
//  · El responsable solo ve el suyo: crear equipos es del administrador (D136, MD-503). Solo puede liderar uno.
// Mover a un delegado de equipo es del administrador. No hay borrar grupos en este sprint. Crear va en un panel lateral que abre la acción del encabezado; cada fila abre otro con sus
// datos, el renombrado (administrador) y sus personas (con el movimiento de delegados).
@Component({
  selector: 'app-team-groups',
  imports: [TranslatePipe, GroupMembers, PageHeader, DataTable, TableCell, TableToolbar, TableFilter, FormModal, Field, EmptyState, PersonCell, Select, Busy],
  templateUrl: './team-groups.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamGroupsView implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly groupApi = inject(GroupService);
  private readonly teamApi = inject(TeamService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  /** Los grupos que ve quien pregunta: todos si es administrador; el suyo si es responsable (vacío mientras no lo cree). */
  readonly groups = signal<Group[]>([]);
  /** Hasta que los grupos llegan no se dice «aún no hay grupos» (quizá ya existen). */
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);
  /** Para el administrador: los responsables, para elegir de quién se crea el equipo. */
  private readonly responsables = signal<TeamMember[]>([]);

  readonly maxName = MAX_NAME;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly createOpen = signal(false);
  /** El grupo cuyo detalle está abierto (por su id: al volver a pedir los grupos, el panel muestra los datos nuevos). */
  readonly detailId = signal<string | null>(null);
  readonly detail = computed(() => this.groups().find((g) => g.id === this.detailId()) ?? null);
  readonly query = signal('');
  readonly kindFilter = signal<GroupKind | ''>('');
  readonly kindOptions: TableFilterOption[] = [
    { value: 'responsables', labelKey: 'TEAM.GROUPS.KIND_RESPONSABLES' },
    { value: 'team', labelKey: 'TEAM.GROUPS.KIND_TEAM' },
  ];
  /** The filter emits text; only a kind of the list (or empty, no filter) is kept. */
  setKindFilter(value: string): void {
    this.kindFilter.set(value === 'responsables' || value === 'team' ? value : '');
  }

  readonly columns: TableColumn<Group>[] = [
    { key: 'name', headerKey: 'TEAM.GROUPS.COLUMNS.NAME' },
    { key: 'kind', headerKey: 'TEAM.GROUPS.COLUMNS.KIND' },
    { key: 'leader', headerKey: 'TEAM.GROUPS.COLUMNS.LEADER', skeleton: 'person' },
    { key: 'members', headerKey: 'TEAM.GROUPS.COLUMNS.MEMBERS', align: 'right' },
  ];
  readonly rowKey = (g: Group): string => g.id;
  readonly hasFilters = computed(() => !!this.query().trim() || !!this.kindFilter());
  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const kind = this.kindFilter();
    return this.groups().filter((g) => (!kind || g.kind === kind) && (!q || g.name.toLowerCase().includes(q) || this.leaderName(g).toLowerCase().includes(q)));
  });

  readonly responsablesGroupName = signal('');
  readonly teamName = signal('');
  readonly teamLeaderId = signal('');

  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');

  /** MD-485 · Hay algo escrito o elegido sin enviar en «Crear»: cerrar pide confirmar antes de descartarlo. */
  readonly createDirty = computed(() => !!(this.responsablesGroupName().trim() || this.teamName().trim() || this.teamLeaderId()));
  /** MD-485 · Se está renombrando el grupo y el nombre escrito ya no es el que tenía. */
  readonly renameDirty = computed(() => {
    const current = this.groups().find((g) => g.id === this.renamingId());
    return !!current && this.renameDraft().trim() !== current.name;
  });

  readonly isAdmin = computed(() => isCompanyAdmin(this.session.user()?.role));
  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));

  /** Los responsables vigentes (activos o pendientes) que aún no lideran un equipo: el servidor rechaza un segundo equipo (`TEAM_ALREADY_EXISTS`). */
  readonly eligibleLeaders = computed(() => {
    const leading = new Set(this.teams().map((g) => g.leader.id));
    return this.responsables().filter((m) => (m.status === 'active' || m.status === 'pending') && !leading.has(m.id));
  });

  readonly leaderOptions = computed<SelectOption[]>(() => this.eligibleLeaders().map((m) => ({ value: m.id, label: this.personName(m) })));
  readonly canCreateResponsablesGroup = computed(() => !!this.responsablesGroupName().trim());
  readonly canCreateTeam = computed(() => !!this.teamName().trim() && !!this.teamLeaderId());
  readonly canRename = computed(() => {
    const draft = this.renameDraft().trim();
    const current = this.groups().find((g) => g.id === this.renamingId());
    return !!draft && !!current && draft !== current.name;
  });

  ngOnInit(): void {
    this.reload();
    if (this.isAdmin()) {
      this.teamApi.list({ role: 'responsable' }, 1, 100).subscribe({ next: (page) => this.responsables.set(page.items), error: () => this.responsables.set([]) });
    }
  }

  /** Pide los grupos otra vez (cada vez que algo los cambió). */
  reload(): void {
    this.groupApi.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loadFailed.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.groups.set([]);
        this.loadFailed.set(true);
        this.loaded.set(true);
      },
    });
  }

  clearFilters(): void {
    this.query.set('');
    this.kindFilter.set('');
  }

  openCreate(): void {
    this.reset();
    // Cada apertura empieza de cero: lo descartado al cerrar no vuelve a aparecer.
    this.responsablesGroupName.set('');
    this.teamName.set('');
    this.teamLeaderId.set('');
    this.createOpen.set(true);
  }

  openDetail(group: Group): void {
    this.reset();
    this.renamingId.set(null);
    this.detailId.set(group.id);
  }

  closeDetail(): void {
    this.detailId.set(null);
    this.renamingId.set(null);
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  leaderName(g: Group): string {
    return this.personName({ email: '', name: g.leader.name, last_name: g.leader.last_name });
  }

  // ─── crear ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  createResponsablesGroup(): void {
    if (this.saving()) return;
    if (!this.canCreateResponsablesGroup()) return;
    this.create({ name: this.responsablesGroupName().trim() }, () => this.responsablesGroupName.set(''));
  }

  createTeam(): void {
    if (this.saving()) return;
    if (!this.canCreateTeam()) return;
    this.create({ name: this.teamName().trim(), leader_id: this.teamLeaderId() }, () => {
      this.teamName.set('');
      this.teamLeaderId.set('');
    });
  }

  private create(dto: CreateGroupDto, done: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.reset();
    this.groupApi.create(dto).subscribe({
      next: (group) => {
        this.saving.set(false);
        done();
        this.createOpen.set(false);
        this.toast.showSuccess(this.translate.instant('TEAM.GROUPS.NOTICE.CREATED', { name: group.name }));
        this.reload();
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
    if (!id || !this.canRename() || this.saving()) return;
    this.saving.set(true);
    this.reset();
    this.groupApi.rename(id, this.renameDraft().trim()).subscribe({
      next: (group) => {
        this.saving.set(false);
        this.renamingId.set(null);
        this.toast.showSuccess(this.translate.instant('TEAM.GROUPS.NOTICE.RENAMED', { name: group.name }));
        this.reload();
      },
      error: (e) => this.fail(e),
    });
  }

  onMoved(): void {
    this.reload();
  }

  /** `message` ya viene traducido por el backend (409: nombre repetido o reservado, el responsable ya tiene equipo; 403; 404). */
  private fail(e: unknown): void {
    this.saving.set(false);
    // Dentro de un formulario (crear, detalle) el error queda junto a los campos; fuera, es un aviso pasajero (toast).
    const fallback = this.translate.instant('TEAM.ERROR.SAVE');
    const message = apiErrorMessage(e, fallback);
    if (this.detail() || this.createOpen()) this.error.set(message);
    else this.toast.showError(fallback, message === fallback ? '' : message);
  }

  private reset(): void {
    this.error.set(null);
  }
}
