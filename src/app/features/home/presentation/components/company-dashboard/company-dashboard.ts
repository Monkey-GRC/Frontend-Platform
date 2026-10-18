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

  /**
   * Los servicios del más urgente al menos: primero los que no cumplen, luego los que van bien encaminados, luego los que aún no tienen resultados y al final los que ya
   * cumplen. Con muchos servicios, lo que hay que atender queda arriba sin buscarlo; a igual urgencia, por nombre.
   */
  readonly ordered = computed(() => {
    const urgency = (s: DashboardServiceSummary) => {
      const fws = s.frameworks;
      if (fws.some((f) => f.readiness === 'needs_work' || (this.measured(f) && f.verdict === 'non_compliant'))) return 0;
      if (fws.some((f) => f.readiness === 'almost_ready')) return 1;
      if (fws.length === 0 || fws.every((f) => f.readiness === 'not_measured')) return 2;
      return fws.every((f) => f.readiness === 'ready') ? 4 : 3;
    };
    return [...this.services()].sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'es'));
  });

  /** Lo más urgente de todos los servicios: los controles que no cumplen, empezando por el servicio más urgente. */
  readonly attention = computed<Attention[]>(() => {
    const list: Attention[] = [];
    for (const s of this.ordered()) for (const f of s.failing) list.push({ ...f, serviceId: s.id, serviceName: s.name });
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

  /** La franja de una tarjeta de servicio lleva el color del estado más delicado de sus marcos (rojo, ámbar, verde); sin resultados, gris. */
  strip(s: DashboardServiceSummary): string {
    const fws = s.frameworks;
    if (fws.some((f) => f.readiness === 'needs_work' || (this.measured(f) && f.verdict === 'non_compliant'))) return 'border-t-red-700';
    if (fws.some((f) => f.readiness === 'almost_ready')) return 'border-t-amber-500';
    if (fws.length > 0 && fws.every((f) => f.readiness === 'ready')) return 'border-t-green-600';
    return 'border-t-gray-300 dark:border-t-gray-600';
  }

  /** El veredicto del motor, con su color lleno: rojo no cumple, verde cumple, ámbar en evaluación. */
  verdictClass(f: DashboardFramework): string {
    return f.verdict === 'non_compliant' ? 'bg-red-700 text-white' : f.verdict === 'compliant' ? 'bg-green-700 text-white' : 'bg-amber-400 text-amber-950';
  }

  bar(f: DashboardFramework): string {
    return f.readiness === 'ready' ? 'bg-green-600' : f.readiness === 'almost_ready' ? 'bg-amber-500' : 'bg-red-700';
  }

  progressValue(f: DashboardFramework): number {
    return percentOf(f.progress.done, f.progress.total) ?? 0;
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
