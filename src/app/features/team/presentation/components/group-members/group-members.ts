import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { Group } from '../../../domain/models/group.models';
import { TeamMember, UpdateMemberDto } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';

type Stage = 'loading' | 'error' | 'ready';
// Quien ejecuta controles no se mueve sin confirmar: se guarda aquí hasta que el administrador diga que sí (USER_HAS_ASSIGNMENTS trae cuántos).
type PendingMove = { member: TeamMember; controls: number };

const PAGE_SIZE = 100;

// Las personas de un grupo y, para el administrador, mover a un delegado al equipo de otro responsable (MD-198, contracts/gestion-usuarios.md → «PATCH /v1/users/{id}»).
// Mover cambia solo su equipo: si ejecuta controles, esos quedan sin ejecutor y siguen con su dueño (D102), y por eso se pide confirmar antes.
@Component({
  selector: 'app-group-members',
  imports: [TranslatePipe, ConfirmDialog],
  templateUrl: './group-members.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMembers implements OnInit {
  private readonly api = inject(TeamService);
  private readonly translate = inject(TranslateService);

  readonly group = input.required<Group>();
  /** Todos los equipos de delegados de la empresa: los destinos posibles de un delegado. */
  readonly teams = input<Group[]>([]);
  /** Solo el administrador mueve a un delegado (la API responde 403 al resto). */
  readonly canMove = input(false);
  /** Se movió a alguien: los conteos de los grupos cambiaron y hay que volver a pedirlos. */
  readonly moved = output<void>();

  readonly stage = signal<Stage>('loading');
  readonly members = signal<TeamMember[]>([]);
  readonly total = signal(0);
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** El delegado que se está por mover y el equipo elegido como destino. */
  readonly movingId = signal<string | null>(null);
  readonly target = signal('');
  readonly pending = signal<PendingMove | null>(null);

  /** Los equipos a los que se puede mover: todos menos el actual. */
  readonly destinations = computed(() => this.teams().filter((t) => t.id !== this.group().id));
  readonly hiddenCount = computed(() => Math.max(0, this.total() - this.members().length));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.list({ groupId: this.group().id }, 1, PAGE_SIZE).subscribe({
      next: (data) => {
        this.members.set(data.items);
        this.total.set(data.total);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  leaderName(g: Group): string {
    return this.personName({ email: '', name: g.leader.name, last_name: g.leader.last_name });
  }

  startMove(m: TeamMember): void {
    this.reset();
    this.movingId.set(m.id);
    this.target.set('');
  }

  cancelMove(): void {
    this.movingId.set(null);
    this.target.set('');
  }

  move(m: TeamMember): void {
    if (!this.target()) return;
    this.send(m, { group_id: this.target() });
  }

  /** El administrador aceptó que los controles del delegado queden sin ejecutor: se repite el movimiento con la confirmación. */
  confirmMove(): void {
    const pending = this.pending();
    if (!pending) return;
    this.send(pending.member, { group_id: this.target(), confirm_unassign: true });
  }

  cancelConfirm(): void {
    this.pending.set(null);
  }

  private send(m: TeamMember, body: UpdateMemberDto): void {
    this.saving.set(true);
    this.reset();
    this.api.update(m.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.pending.set(null);
        this.movingId.set(null);
        this.target.set('');
        this.notice.set(this.translate.instant('TEAM.GROUPS.NOTICE.MOVED', { name: this.personName(m) }));
        this.load();
        this.moved.emit();
      },
      error: (e) => {
        this.saving.set(false);
        this.fail(e, m);
      },
    });
  }

  private fail(e: unknown, m: TeamMember): void {
    switch (apiErrorCode(e)) {
      case 'USER_HAS_ASSIGNMENTS': {
        const count = apiErrorData(e)['controls_count'];
        this.pending.set({ member: m, controls: typeof count === 'number' ? count : 0 });
        return;
      }
      // El equipo de destino no existe o su responsable ya no está activo ni pendiente: el servidor responde 404.
      case 'NOT_FOUND':
        this.pending.set(null);
        this.error.set(this.translate.instant('TEAM.GROUPS.ERROR.MOVE_TARGET'));
        return;
      default:
        this.pending.set(null);
        this.error.set(apiErrorMessage(e, this.translate.instant('TEAM.ERROR.SAVE')));
    }
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
