import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Card } from '@shared/presentation/components/card/card';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { HomeTeamRole } from '@features/home/domain/models/team.models';
import { HomeTeamService, MAX_PEOPLE } from '@features/home/domain/services/team-overview.service';
import { SUMMARY_ROLES, TeamSummary, summarizeTeam } from '@features/home/domain/utils/team-summary';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

interface AccessRow {
  id: string;
  value: number;
  labelKey: string;
  tone: StatusTone | null;
  statusKey: string | null;
}

type Stage = 'loading' | 'error' | 'ready';

// Los dos bloques del Inicio que salen del equipo: «Tu equipo» (personas por rol y por estado) y «Acceso y seguridad de cuentas» (segundo factor e invitaciones). Salen de la lista que ya
// devuelve `GET /v1/users`; solo se monta para quien puede ver el equipo (el padre decide), así que no se hace una llamada que acabaría en 403. No calcula cumplimiento ni certifica nada:
// cuenta cuentas. La casilla de cada bloque es una columna del grid del padre (el host es `display: contents`).
@Component({
  selector: 'app-team-blocks',
  imports: [TranslatePipe, RouterLink, Card, EmptyState, StatusIndicator, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './team-blocks.html',
})
export class TeamBlocks {
  private readonly api = inject(HomeTeamService);

  readonly stage = signal<Stage>('loading');
  readonly summary = signal<TeamSummary | null>(null);
  /** La lista pasó del tope de páginas y se cortó: se dice, en vez de contar mal en silencio. */
  readonly partial = signal(false);
  readonly maxPeople = MAX_PEOPLE;
  readonly empty = computed(() => (this.summary()?.total ?? 0) === 0);

  /** Una fila por rol, con su clase de color de la paleta de datos escrita completa (el color identifica la categoría, no un estado). */
  readonly roles = computed(() => {
    const s = this.summary();
    const rows: Record<HomeTeamRole, { labelKey: string; bg: string }> = {
      admin_empresa: { labelKey: 'TEAM.ROLE.ADMIN_EMPRESA', bg: 'bg-data-1' },
      responsable: { labelKey: 'TEAM.ROLE.RESPONSABLE', bg: 'bg-data-2' },
      delegado: { labelKey: 'TEAM.ROLE.DELEGADO', bg: 'bg-data-3' },
      auditor: { labelKey: 'TEAM.ROLE.AUDITOR', bg: 'bg-data-4' },
    };
    return SUMMARY_ROLES.map((role) => ({ role, ...rows[role], count: s?.byRole[role] ?? 0 }));
  });

  /** Las filas de «Acceso y seguridad de cuentas»: cifra + etiqueta corta, con su estado (punto y palabra). Solo cuenta; no certifica nada. */
  readonly accessRows = computed<AccessRow[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const review = (n: number): Pick<AccessRow, 'tone' | 'statusKey'> => (n === 0 ? { tone: 'ok', statusKey: 'HOME.ACCESS.ALL_PROTECTED' } : { tone: 'warn', statusKey: 'HOME.ACCESS.NEEDS_REVIEW' });
    return [
      { id: 'no-mfa', value: s.withoutSecondFactor, labelKey: 'HOME.ACCESS.NO_SECOND_FACTOR', ...review(s.withoutSecondFactor) },
      { id: 'pending', value: s.pending, labelKey: 'HOME.ACCESS.PENDING', ...review(s.pending) },
      { id: 'stale', value: s.withoutRecentLogin, labelKey: 'HOME.ACCESS.NO_RECENT_LOGIN', ...review(s.withoutRecentLogin) },
      { id: 'blocked', value: s.blocked, labelKey: 'HOME.ACCESS.BLOCKED', ...(s.blocked === 0 ? review(0) : { tone: 'neutral' as const, statusKey: 'HOME.ACCESS.NO_ACCESS' }) },
      // Solo informa el número; con cero administradores activos sí se pide revisar.
      { id: 'admins', value: s.activeAdmins, labelKey: 'HOME.ACCESS.ACTIVE_ADMINS', ...(s.activeAdmins === 0 ? review(1) : { tone: null, statusKey: null }) },
    ];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.loadAll().subscribe({
      next: ({ members, partial }) => {
        this.partial.set(partial);
        this.summary.set(summarizeTeam(members));
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  /** El ancho de cada tramo de la barra, en proporción al total. */
  share(count: number): number {
    const total = this.summary()?.total ?? 0;
    return total === 0 ? 0 : (count / total) * 100;
  }
}
