import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { StatusBadge } from '@shared/presentation/components/status-badge/status-badge';
import { Dashboard, DashboardAttention, DashboardFramework, DashboardServiceSummary } from '../../../domain/models/dashboard.models';
import { HomeDashboardService } from '../../../domain/services/dashboard.service';

type Stage = 'loading' | 'error' | 'ready';

interface Attention extends DashboardAttention {
  serviceId: string;
  serviceName: string;
}

const MAX_ATTENTION = 5;

// El resumen de la empresa en el Inicio (el dashboard de las cuatro preguntas, philosophy.md): ¿estamos bien?, ¿qué es urgente? Cuenta lo que la empresa tiene (servicios, activos,
// marcos, controles, riesgos, causas) y dice cómo va cada servicio en cada marco: estado, avance y cobertura juntos, nunca un porcentaje solo (D80). No hay un número de toda la
// empresa: el cumplimiento se mide por servicio × marco. Hoy solo el administrador de la empresa lee los servicios (B1), así que solo a él se le muestra.
@Component({
  selector: 'app-company-dashboard',
  imports: [TranslatePipe, RouterLink, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-dashboard.html',
})
export class CompanyDashboard {
  private readonly api = inject(HomeDashboardService);
  private readonly language = inject(LanguageService);
  private readonly session = inject(SessionService);

  readonly stage = signal<Stage>('loading');
  readonly data = signal<Dashboard>({ services: [] });

  /** Solo el administrador de la empresa lee los servicios; para el resto el panel no se muestra. */
  readonly allowed = computed(() => this.session.user()?.role === 'admin_empresa');
  readonly services = computed(() => this.data().services);

  readonly totals = computed(() => {
    const s = this.services();
    const frameworks = new Set(s.flatMap((x) => x.frameworks.map((f) => f.code)));
    return {
      services: s.length,
      assets: s.reduce((n, x) => n + x.assets, 0),
      frameworks: frameworks.size,
      controls: s.reduce((n, x) => n + x.controls, 0),
      risks: s.reduce((n, x) => n + x.risks, 0),
      risksEvaluated: s.reduce((n, x) => n + x.risksEvaluated, 0),
      causes: s.reduce((n, x) => n + x.causes, 0),
    };
  });

  /** Lo más urgente de todos los servicios: los controles que no cumplen, los primeros de cada uno. */
  readonly attention = computed<Attention[]>(() => {
    const list: Attention[] = [];
    for (const s of this.services()) for (const f of s.failing) list.push({ ...f, serviceId: s.id, serviceName: s.name });
    return list.slice(0, MAX_ATTENTION);
  });
  readonly attentionTotal = computed(() => this.services().reduce((n, s) => n + s.failing.length, 0));

  constructor() {
    if (this.allowed()) this.load();
  }

  load(): void {
    this.stage.set('loading');
    // La vista técnica trae el veredicto del motor (cumple / no cumple); el administrador la recibe.
    this.api.load(true).subscribe({
      next: (data) => {
        this.data.set(data);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  /** Un marco sin nada decidido no muestra porcentaje: «Sin medir» no es un cero. */
  measured(f: DashboardFramework): boolean {
    return f.readiness !== 'not_measured';
  }

  link(s: DashboardServiceSummary): string[] {
    return ['/services', s.id, 'cumplimiento', 'resumen'];
  }

  controlsLink(serviceId: string): string[] {
    return ['/services', serviceId, 'cumplimiento', 'controles'];
  }

  verdictKey(f: DashboardFramework): string | null {
    const states: Record<string, string> = {
      compliant: 'COMPLIANCE.OVERVIEW.VERDICT.COMPLIANT',
      non_compliant: 'COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT',
      evaluating: 'COMPLIANCE.OVERVIEW.VERDICT.EVALUATING',
    };
    return this.measured(f) && f.verdict ? (states[f.verdict] ?? null) : null;
  }
}
