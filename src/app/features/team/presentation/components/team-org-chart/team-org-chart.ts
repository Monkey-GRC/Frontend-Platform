import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { targetChecked, targetValue } from '@shared/presentation/utils/event-target';
import { Group } from '@features/team/domain/models/group.models';
import { TeamActor, TeamMember, UpdateMemberDto } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { OrgResponsible, OrgWorkload, buildOrgChart } from '@features/team/domain/utils/team-org';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

type Stage = 'loading' | 'error' | 'ready';
// Quien ejecuta controles no se mueve sin confirmar (USER_HAS_ASSIGNMENTS trae cuántos).
interface PendingMove { member: TeamMember; controls: number }

/** Con pocos responsables se ven todos abiertos; con muchos, cerrados, para no saturar. */
const OPEN_BY_DEFAULT_UP_TO = 4;

// El organigrama de la empresa (D102, D104): administradores arriba, bajo cada responsable sus delegados y, aparte, los auditores. Es una página propia (`/equipo/organigrama`): el cliente
// ve quién depende de quién. Debajo hay un grupo por responsable (su equipo), que nace solo al crear al responsable; aquí se puede renombrar (administrador) y
// crear si falta. Mover a un delegado es elegir otro responsable. Todo usa las llamadas que ya existen (`/users`, `/groups`): no hay contrato nuevo.
// Cuando el Backend entregue la carga por persona (MD-195), `workload` mostrará controles y avance; mientras no, no se pinta nada de eso.
@Component({
  selector: 'app-team-org-chart',
  imports: [TranslatePipe, ConfirmDialog, NgTemplateOutlet, PersonCell, StatusIndicator, EmptyState, Select, Skeleton, SkeletonRegion, Busy, BusyFields],
  templateUrl: './team-org-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamOrgChart implements OnInit {
  protected readonly targetValue = targetValue;
  protected readonly targetChecked = targetChecked;
  private readonly teamApi = inject(TeamService);
  private readonly groupApi = inject(GroupService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  readonly actor = input.required<TeamActor>();
  /** Los grupos que ve quien pregunta: todos si es administrador; el suyo si es responsable. */
  readonly groups = input<Group[]>([]);
  /** Hasta que los grupos llegan no se dice «aún no tiene equipo» (quizá ya existe). */
  readonly groupsLoaded = input(true);
  /** Controles y avance por persona (id → carga). Vacío hasta que el Backend lo entregue. */
  readonly workload = input<Record<string, OrgWorkload>>({});
  /** Se creó o renombró un equipo, o se movió a alguien: la pantalla debe volver a pedir los grupos y la lista de personas. */
  readonly changed = output<void>();

  readonly stage = signal<Stage>('loading');
  private readonly members = signal<TeamMember[]>([]);
  readonly showInactive = signal(false);
  readonly saving = signal(false);

  readonly isAdmin = computed(() => isCompanyAdmin(this.actor()));
  /** Un responsable que mira se dibuja a sí mismo aunque aún no tenga equipo ni la lista lo traiga. */
  private readonly self = computed(() => {
    const user = this.session.user();
    return !this.isAdmin() && user ? { id: user.id, name: user.name, last_name: user.last_name } : null;
  });
  readonly chart = computed(() => buildOrgChart(this.members(), this.groups(), this.showInactive(), this.self()));
  readonly teams = computed(() => this.groups().filter((g) => g.kind === 'team'));
  readonly isEmpty = computed(() => {
    const c = this.chart();
    return !c.admins.length && !c.responsibles.length && !c.auditors.length && !c.collaborators.length && !c.orphans.length;
  });

  // Abrir y cerrar a cada responsable
  private readonly toggled = signal<ReadonlySet<string>>(new Set());
  private readonly openByDefault = computed(() => this.chart().responsibles.length <= OPEN_BY_DEFAULT_UP_TO);

  // Crear el equipo de un responsable
  readonly creatingFor = signal<string | null>(null);
  readonly teamNameDraft = signal('');
  // Renombrar un equipo
  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');
  // Mover a un delegado
  readonly movingId = signal<string | null>(null);
  readonly target = signal('');
  readonly pending = signal<PendingMove | null>(null);

  readonly canCreateTeam = computed(() => !!this.teamNameDraft().trim());
  readonly canRename = computed(() => {
    const draft = this.renameDraft().trim();
    const current = this.groups().find((g) => g.id === this.renamingId());
    return !!draft && !!current && draft !== current.name;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.teamApi.listAll().subscribe({
      next: (all) => {
        this.members.set(all);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  /** Vuelve a pedir las personas sin tapar el organigrama con el cargador (se llama tras cada cambio). */
  private refresh(): void {
    this.teamApi.listAll().subscribe({ next: (all) => this.members.set(all), error: () => undefined });
  }

  isOpen(id: string): boolean {
    return this.openByDefault() !== this.toggled().has(id);
  }

  toggle(id: string): void {
    this.toggled.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  personName(p: { email?: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email || '';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  }

  progressOf(id: string): number | null {
    const p = this.workload()[id]?.progress;
    return p && p.total > 0 ? Math.round((p.done / p.total) * 100) : null;
  }

  /** ¿Quien mira puede crear el equipo de este responsable? Solo el administrador, el de cualquiera (D136: el responsable ya no crea el suyo). */
  canCreateTeamFor(node: OrgResponsible): boolean {
    return this.groupsLoaded() && !node.team && this.isAdmin();
  }

  /** Los demás equipos a los que se puede mover un delegado: el nombre del responsable primero, que es lo que la persona reconoce. */
  destinations(current: TeamMember): SelectOption[] {
    return this.teams()
      .filter((t) => t.id !== current.group?.id)
      .map((t) => ({ value: t.id, label: this.translate.instant('TEAM.ORG.DESTINATION', { leader: this.personName(t.leader), team: t.name }) }));
  }

  // ─── crear el equipo ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  startCreate(node: OrgResponsible): void {
    this.creatingFor.set(node.id);
    this.teamNameDraft.set(this.translate.instant('TEAM.ORG.DEFAULT_TEAM_NAME', { name: node.name }));
  }

  cancelCreate(): void {
    this.creatingFor.set(null);
  }

  createTeam(node: OrgResponsible): void {
    if (!this.canCreateTeam() || this.saving()) return;
    this.run(this.groupApi.create({ name: this.teamNameDraft().trim(), leader_id: node.id }), (g) => {
      this.creatingFor.set(null);
      this.toast.showSuccess(this.translate.instant('TEAM.ORG.NOTICE.CREATED', { name: g.name }));
    });
  }

  // ─── renombrar el equipo ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  startRename(team: Group): void {
    this.renamingId.set(team.id);
    this.renameDraft.set(team.name);
  }

  cancelRename(): void {
    this.renamingId.set(null);
  }

  saveRename(): void {
    const id = this.renamingId();
    if (!id || !this.canRename() || this.saving()) return;
    this.run(this.groupApi.rename(id, this.renameDraft().trim()), (g) => {
      this.renamingId.set(null);
      this.toast.showSuccess(this.translate.instant('TEAM.ORG.NOTICE.RENAMED', { name: g.name }));
    });
  }

  // ─── mover a un delegado de responsable ──────────────────────────────────────────────────────────────────────────────────────────────────────
  startMove(m: TeamMember): void {
    this.movingId.set(m.id);
    this.target.set('');
  }

  cancelMove(): void {
    this.movingId.set(null);
    this.target.set('');
  }

  move(m: TeamMember): void {
    if (this.target()) this.sendMove(m, { group_id: this.target() });
  }

  confirmMove(): void {
    const pending = this.pending();
    if (pending) this.sendMove(pending.member, { group_id: this.target(), confirm_unassign: true });
  }

  cancelConfirm(): void {
    this.pending.set(null);
  }

  private sendMove(m: TeamMember, body: UpdateMemberDto): void {
    if (this.saving()) return;
    this.run(
      this.teamApi.update(m.id, body),
      () => {
        this.pending.set(null);
        this.movingId.set(null);
        this.target.set('');
        this.toast.showSuccess(this.translate.instant('TEAM.ORG.NOTICE.MOVED', { name: this.personName(m) }));
      },
      (e) => {
        if (apiErrorCode(e) === 'USER_HAS_ASSIGNMENTS') {
          const count = apiErrorData(e)['controls_count'];
          this.pending.set({ member: m, controls: typeof count === 'number' ? count : 0 });
          return true;
        }
        // El equipo de destino no existe o su responsable ya no está activo ni pendiente: el servidor responde 404.
        if (apiErrorCode(e) === 'NOT_FOUND') {
          this.pending.set(null);
          this.toast.showError(this.translate.instant('TEAM.ORG.ERROR.MOVE_TARGET'));
          return true;
        }
        this.pending.set(null);
        return false;
      },
    );
  }

  // ─── común ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** `onError` devuelve `true` si ya manejó el error; si no, se muestra el mensaje que trae el servidor (ya traducido). */
  private run<T>(call: Observable<T>, done: (result: T) => void, onError?: (e: unknown) => boolean): void {
    this.saving.set(true);
    call.subscribe({
      next: (result) => {
        this.saving.set(false);
        done(result);
        this.refresh();
        this.changed.emit();
      },
      error: (e) => {
        this.saving.set(false);
        if (onError?.(e)) return;
        // Un error de una acción es un aviso pasajero (toast): el título dice qué falló y el mensaje, lo que respondió el servidor.
        const fallback = this.translate.instant('TEAM.ERROR.SAVE');
        const message = apiErrorMessage(e, fallback);
        this.toast.showError(fallback, message === fallback ? '' : message);
      },
    });
  }

}
