import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, of } from 'rxjs';
import { OWNER_ASSIGNMENT_ENABLED } from '@config/features.config';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { Dimension, DimensionOwner, ServiceRef, TeamMember, TeamMemberWithCode } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';

type Stage = 'loading' | 'error' | 'ready';
type Tab = 'people' | 'work';
type Pending = { kind: 'deactivate' | 'reset_mfa'; member: TeamMember };

// El código que se acaba de emitir: solo se ve ahora (el backend no lo guarda), así que se queda en pantalla hasta que la persona lo anota.
type IssuedCode = { email: string; code: string; expiresAt: string };

// El equipo de la empresa (MD-134, D96). El administrador invita a su gente, les da una especialidad (una o más dimensiones), les entrega el código para activar su cuenta
// y reparte el trabajo: quién es el responsable de cada dimensión en cada servicio. Un `funcional` ve y hace solo lo suyo; el `auditor` lo ve todo en solo lectura.
@Component({
  selector: 'app-team',
  imports: [PageHeader, TranslatePipe, ConfirmDialog, LoadingSpinner, DatePipe],
  templateUrl: './team.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamView implements OnInit {
  private readonly api = inject(TeamService);
  private readonly translate = inject(TranslateService);
  readonly myId = inject(SessionService).user;
  // D97: repartir el trabajo a personas concretas queda apagado; hoy el funcional atiende todo lo de su especialidad.
  readonly ownerAssignment = inject(OWNER_ASSIGNMENT_ENABLED);

  // Las dimensiones salen del backend (enum `dimension`); el orden es el del contrato.
  readonly dimensionOptions = toSignal(inject(CatalogService).options('dimension'), { initialValue: [] });

  readonly stage = signal<Stage>('loading');
  readonly tab = signal<Tab>('people');
  readonly members = signal<TeamMember[]>([]);
  readonly services = signal<ServiceRef[]>([]);
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly issued = signal<IssuedCode | null>(null);
  readonly copied = signal(false);

  // Alta
  readonly inviteEmail = signal('');
  readonly inviteName = signal('');
  readonly inviteLastName = signal('');
  readonly inviteRole = signal<'funcional' | 'auditor' | 'admin_empresa'>('funcional');
  readonly inviteDimensions = signal<Dimension[]>([]);
  // El correo identifica a la persona: si ya está en el equipo se avisa antes de intentar crear nada. Si es de otra empresa, lo dice el servidor al enviar (409).
  readonly existing = computed(() => {
    const email = this.inviteEmail().trim().toLowerCase();
    return email ? (this.members().find((m) => m.email.toLowerCase() === email) ?? null) : null;
  });
  readonly emailError = signal<string | null>(null);
  readonly canInvite = computed(
    () =>
      /^\S+@\S+\.\S+$/.test(this.inviteEmail().trim()) &&
      !!this.inviteName().trim() &&
      !!this.inviteLastName().trim() &&
      (this.inviteRole() !== 'funcional' || this.inviteDimensions().length > 0) &&
      !this.existing() &&
      !this.saving(),
  );

  // Corregir el nombre de alguien del equipo
  readonly nameEditing = signal<string | null>(null);
  readonly nameDraft = signal('');
  readonly lastNameDraft = signal('');
  readonly canSaveName = computed(() => !!this.nameDraft().trim() && !!this.lastNameDraft().trim() && !this.saving());

  // Cambio de especialidades de un funcional
  readonly editing = signal<string | null>(null);
  readonly editDimensions = signal<Dimension[]>([]);

  // Confirmaciones (desactivar, quitar el segundo factor)
  readonly confirming = signal<Pending | null>(null);

  // Reparto del trabajo por servicio
  readonly serviceId = signal<string | null>(null);
  readonly owners = signal<DimensionOwner[]>([]);
  readonly ownersStage = signal<Stage>('ready');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({ page: this.api.list(), services: this.ownerAssignment ? this.api.services() : of<ServiceRef[]>([]) }).subscribe({
      next: ({ page, services }) => {
        this.members.set(page.items);
        this.services.set(services);
        this.stage.set('ready');
        if (!this.serviceId() && services.length) this.chooseService(services[0].id);
      },
      error: () => this.stage.set('error'),
    });
  }

  dimensionLabel(value: string): string {
    return this.dimensionOptions().find((o) => o.value === value)?.label ?? value;
  }

  isMe(m: TeamMember): boolean {
    return m.id === this.myId()?.id;
  }

  // ─── invitar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  toggleInvite(dimension: Dimension): void {
    this.inviteDimensions.update((list) => (list.includes(dimension) ? list.filter((d) => d !== dimension) : [...list, dimension]));
  }

  setRole(role: 'funcional' | 'auditor' | 'admin_empresa'): void {
    this.inviteRole.set(role);
    if (role !== 'funcional') this.inviteDimensions.set([]);
  }

  setEmail(value: string): void {
    this.inviteEmail.set(value);
    this.emailError.set(null);
  }

  invite(): void {
    if (!this.canInvite()) return;
    const role = this.inviteRole();
    const body = {
      email: this.inviteEmail().trim(),
      name: this.inviteName().trim(),
      last_name: this.inviteLastName().trim(),
      role,
      ...(role === 'funcional' ? { dimensions: this.inviteDimensions() } : {}),
    };
    this.run(
      this.api.invite(body),
      'TEAM.NOTICE.INVITED',
      (created) => {
        this.showCode(created);
        this.inviteEmail.set('');
        this.inviteName.set('');
        this.inviteLastName.set('');
        this.inviteDimensions.set([]);
      },
      undefined,
      // Un correo que ya existe en la plataforma se dice bajo el campo del correo, no en un aviso general.
      (e) => {
        if (apiErrorCode(e) !== 'EMAIL_TAKEN') return false;
        this.emailError.set(apiErrorMessage(e, this.translate.instant('TEAM.INVITE.EMAIL_TAKEN')));
        return true;
      },
    );
  }

  /** El correo ya es de alguien del equipo: en vez de crearlo otra vez, se le corrige el nombre. */
  fixExisting(): void {
    const m = this.existing();
    if (!m) return;
    this.inviteEmail.set('');
    this.startNameEdit(m);
  }

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
  reissue(m: TeamMember): void {
    this.run(this.api.reissueCode(m.id), 'TEAM.NOTICE.CODE_REISSUED', (created) => this.showCode(created));
  }

  async copyCode(): Promise<void> {
    const code = this.issued()?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      // Sin permiso del navegador: la persona lo copia a mano (el código está a la vista).
    }
  }

  dismissCode(): void {
    this.issued.set(null);
    this.copied.set(false);
  }

  private showCode(created: TeamMemberWithCode): void {
    this.copied.set(false);
    this.issued.set({ email: created.email, code: created.activation_code.code, expiresAt: created.activation_code.expires_at });
  }

  // ─── especialidades ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  startEdit(m: TeamMember): void {
    this.resetMessages();
    this.editing.set(m.id);
    this.editDimensions.set([...m.dimensions]);
  }

  toggleEdit(dimension: Dimension): void {
    this.editDimensions.update((list) => (list.includes(dimension) ? list.filter((d) => d !== dimension) : [...list, dimension]));
  }

  saveEdit(): void {
    const id = this.editing();
    if (!id || !this.editDimensions().length) return;
    this.run(this.api.update(id, { dimensions: this.editDimensions() }), 'TEAM.NOTICE.UPDATED', () => this.editing.set(null));
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

  // ─── reparto del trabajo ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  chooseService(id: string): void {
    this.serviceId.set(id);
    this.ownersStage.set('loading');
    this.api.dimensionOwners(id).subscribe({
      next: (owners) => {
        this.owners.set(owners);
        this.ownersStage.set('ready');
      },
      error: () => this.ownersStage.set('error'),
    });
  }

  /** Los `funcional` que pueden ser responsables de una dimensión: activos o pendientes y con esa especialidad. */
  candidates(dimension: Dimension): TeamMember[] {
    return this.members().filter((m) => m.role === 'funcional' && m.status !== 'inactive' && m.dimensions.includes(dimension));
  }

  setOwner(dimension: Dimension, userId: string): void {
    const serviceId = this.serviceId();
    if (!serviceId) return;
    this.resetMessages();
    this.saving.set(true);
    this.api.setDimensionOwner(serviceId, dimension, userId || null).subscribe({
      next: (row) => {
        this.saving.set(false);
        this.owners.update((rows) => rows.map((r) => (r.dimension === row.dimension ? row : r)));
        this.notice.set(this.translate.instant('TEAM.NOTICE.OWNER_SAVED'));
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
        this.chooseService(serviceId); // vuelve a lo que de verdad quedó guardado
      },
    });
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  // ─── común ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  private run<T>(call: Observable<T>, noticeKey: string, done: (result: T) => void, failed?: () => void, handled?: (error: unknown) => boolean): void {
    this.saving.set(true);
    this.resetMessages();
    call.subscribe({
      next: (result) => {
        this.saving.set(false);
        done(result);
        this.notice.set(this.translate.instant(noticeKey));
        this.refresh();
      },
      // `message` ya viene traducido por el backend (409: ya existe, no activada, especialidad en uso; 422: campos).
      error: (e) => {
        this.saving.set(false);
        failed?.();
        if (handled?.(e)) return;
        this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
      },
    });
  }

  private refresh(): void {
    this.api.list().subscribe({ next: (page) => this.members.set(page.items) });
    const serviceId = this.serviceId();
    if (this.ownerAssignment && serviceId) this.api.dimensionOwners(serviceId).subscribe({ next: (owners) => this.owners.set(owners) });
  }

  private resetMessages(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
