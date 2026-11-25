import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { Card } from '@shared/presentation/components/card/card';
import { Donut, DonutColor } from '@shared/presentation/components/donut/donut';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { DashboardFramework, DashboardServiceSummary } from '@features/home/domain/models/dashboard.models';
import { serviceReadiness } from '@features/home/domain/utils/service-status';

// La card de un servicio en el Inicio: su estado general (el peor de sus marcos), cuatro cifras y, por marco, una dona con el avance al centro y, a su lado, el estado y la cobertura: los tres juntos.
// La unidad es servicio × marco: no hay un porcentaje del servicio ni de la empresa.
@Component({
  selector: 'app-service-card',
  imports: [TranslatePipe, RouterLink, Card, Donut, StatusIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-card.html',
})
export class ServiceCard {
  protected readonly readinessLook = readinessLook;
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly service = input.required<DashboardServiceSummary>();
  readonly link = input.required<string[] | UrlTree>();
  /** El color de datos de cada marco (por código), igual en todas las cards para que un marco se reconozca. Sin él, por orden en la card. */
  readonly palette = input<Record<string, DonutColor>>({});

  readonly overall = computed(() => serviceReadiness(this.service().frameworks));

  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  /** Un marco sin nada decidido no muestra porcentaje: «Sin medir» no es un cero. */
  measured(f: DashboardFramework): boolean {
    return f.readiness !== 'not_measured';
  }

  verdictTone(f: DashboardFramework): StatusTone {
    return f.verdict === 'non_compliant' ? 'bad' : f.verdict === 'compliant' ? 'ok' : 'warn';
  }

  verdictKey(f: DashboardFramework): string | null {
    const states: Record<string, string> = {
      compliant: 'COMPLIANCE.OVERVIEW.VERDICT.COMPLIANT',
      non_compliant: 'COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT',
      evaluating: 'COMPLIANCE.OVERVIEW.VERDICT.EVALUATING',
    };
    return this.measured(f) && f.verdict ? (states[f.verdict] ?? null) : null;
  }

  colorOf(f: DashboardFramework): DonutColor {
    const fixed = this.palette()[f.code];
    if (fixed) return fixed;
    return ((this.service().frameworks.indexOf(f) % 5) + 1) as DonutColor;
  }

  /** El valor de la dona para lectores de pantalla: el marco y su avance, o «sin medir» (nunca un 0 %). */
  donutLabel(f: DashboardFramework): string {
    const value = this.measured(f)
      ? this.translate.instant('HOME.DASHBOARD.PROGRESS', { percent: this.pct(f.progress.done, f.progress.total) })
      : this.translate.instant('COMMON.READINESS.LABEL.NOT_MEASURED');
    return `${f.name}: ${value}`;
  }

  /** El paso «Medir un marco → Definir su período auditado»: lleva al Resumen del servicio con el formulario de ese marco abierto. */
  definePeriodLink(f: DashboardFramework): UrlTree {
    return this.router.createUrlTree(['/cumplimiento', 'resumen'], { queryParams: { servicio: this.service().id, definir: f.code } });
  }

  progressValue(f: DashboardFramework): number {
    return percentOf(f.progress.done, f.progress.total) ?? 0;
  }
}
