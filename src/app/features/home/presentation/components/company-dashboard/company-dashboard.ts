import { storedLanguage } from '@core/domain/services/language.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { canReachPath } from '@core/presentation/components/app-sidebar/sidebar-groups';
import { NAV_ITEMS } from '@config/navigation.config';
import { Card } from '@shared/presentation/components/card/card';
import { MetricCard, MetricColor } from '@shared/presentation/components/metric-card/metric-card';
import { DonutColor } from '@shared/presentation/components/donut/donut';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { PageInfo } from '@shared/presentation/components/data-table/table-page';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Dashboard, DashboardAttention, DashboardFramework, DashboardServiceSummary } from '@features/home/domain/models/dashboard.models';
import { HomeDashboardService } from '@features/home/domain/services/dashboard.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { ServiceCard } from '../service-card/service-card';
import { TeamBlocks } from '../team-blocks/team-blocks';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

interface Attention extends DashboardAttention {
  serviceId: string;
  serviceName: string;
}

const PAGE_SIZES = [10, 25, 50];

// El resumen de la empresa en el Inicio (el dashboard de las cuatro preguntas, philosophy.md): ¿estamos bien?, ¿qué es urgente? Cuenta lo que la empresa tiene (servicios, activos,
// marcos, controles, riesgos, causas) y dice cómo va cada servicio en cada marco: estado, avance y cobertura juntos, nunca un porcentaje solo (D80). No hay un número de toda la
// empresa: el cumplimiento se mide por servicio × marco. Hoy solo el administrador de la empresa lee los servicios (B1), así que solo a él se le muestra.
@Component({
  selector: 'app-company-dashboard',
  imports: [TranslatePipe, RouterLink, Card, MetricCard, Tag, EmptyState, DataTable, TableCell, ServiceCard, TeamBlocks, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-dashboard.html',
})
export class CompanyDashboard {
  private readonly api = inject(HomeDashboardService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly stage = signal<Stage>('loading');
  readonly data = signal<Dashboard>({ services: [] });

  /** Solo el administrador de la empresa lee los servicios; para el resto el panel no se muestra. */
  readonly allowed = computed(() => isCompanyAdmin(this.session.user()?.role));
  /** Quien ya puede ver el equipo (lo que dice el menú: el administrador y el responsable, su equipo): solo a ellos se les piden las personas, así no hay llamadas que acaben en 403. */
  readonly canSeeTeam = computed(() => canReachPath(NAV_ITEMS, this.session.user()?.role, '/equipo/personas'));
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

  /** Las seis cifras de «Tu empresa»: icono y color de datos fijos por métrica (servicios y causas comparten el azul de marca: hay cinco colores y seis cifras), etiqueta y número. Ninguna lleva enlace: hoy ninguna navega a otra pantalla. */
  readonly kpis = computed(() => {
    const t = this.totals();
    return [
      { id: 'services', icon: 'dns', color: 'data-1' as MetricColor, value: t.services, labelKey: 'HOME.DASHBOARD.SERVICES' },
      { id: 'assets', icon: 'inventory_2', color: 'data-2' as MetricColor, value: t.assets, labelKey: 'HOME.DASHBOARD.ASSETS' },
      { id: 'frameworks', icon: 'verified_user', color: 'data-3' as MetricColor, value: t.frameworks, labelKey: 'HOME.DASHBOARD.FRAMEWORKS' },
      { id: 'controls', icon: 'fact_check', color: 'data-4' as MetricColor, value: t.controls, labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS' },
      { id: 'risks', icon: 'crisis_alert', color: 'data-5' as MetricColor, value: t.risks, labelKey: 'COMPLIANCE.GLOSSARY.RISKS' },
      { id: 'causes', icon: 'account_tree', color: 'data-1' as MetricColor, value: t.causes, labelKey: 'COMPLIANCE.GLOSSARY.CAUSES' },
    ];
  });

  /** El color de datos de cada marco por código, estable entre cards: los marcos, ordenados por código, reciben de la paleta de cinco en cinco. */
  readonly palette = computed<Record<string, DonutColor>>(() => {
    const codes = [...new Set(this.services().flatMap((s) => s.frameworks.map((f) => f.code)))].sort();
    return Object.fromEntries(codes.map((c, i) => [c, ((i % 5) + 1) as DonutColor]));
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
    return [...this.services()].sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, storedLanguage()));
  });

  /** Lo más urgente de todos los servicios: los controles que no cumplen, empezando por el servicio más urgente. */
  readonly attention = computed<Attention[]>(() => {
    const list: Attention[] = [];
    for (const s of this.ordered()) for (const f of s.failing) list.push({ ...f, serviceId: s.id, serviceName: s.name });
    return list;
  });

  /** La tabla de atención se pagina aquí, sobre la lista que ya llegó: no se pide nada más al servidor. */
  readonly attentionPageSizes = PAGE_SIZES;
  readonly attentionPageSize = signal(PAGE_SIZES[0]);
  private readonly attentionPageRequested = signal(1);
  readonly attentionPageInfo = computed<PageInfo>(() => {
    const total = this.attention().length;
    const pageSize = this.attentionPageSize();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { page: Math.min(this.attentionPageRequested(), totalPages), pageSize, total, totalPages };
  });
  readonly attentionPage = computed<Attention[]>(() => {
    const { page, pageSize } = this.attentionPageInfo();
    return this.attention().slice((page - 1) * pageSize, page * pageSize);
  });

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

  /** Un marco sin nada decidido no se cuenta como medido: «Sin medir» no es un cero. */
  measured(f: DashboardFramework): boolean {
    return f.readiness !== 'not_measured';
  }

  // Cumplimiento no lleva el id en la ruta: el servicio se manda en `?servicio=` y el encabezado de Cumplimiento lo deja como activo.
  link(s: DashboardServiceSummary): UrlTree {
    return this.router.createUrlTree(['/cumplimiento', 'resumen'], { queryParams: { servicio: s.id } });
  }

  readonly attentionColumns: TableColumn<Attention>[] = [
    { key: 'code', headerKey: 'HOME.DASHBOARD.ATTENTION_COL.CODE', class: 'w-28' },
    { key: 'name', headerKey: 'HOME.DASHBOARD.ATTENTION_COL.CONTROL' },
    { key: 'service', headerKey: 'HOME.DASHBOARD.ATTENTION_COL.SERVICE' },
  ];
  readonly attentionKey = (a: Attention): string => a.controlId;

  goToAttentionPage(page: number): void {
    this.attentionPageRequested.set(page);
  }

  resizeAttention(size: number): void {
    this.attentionPageSize.set(size);
    this.attentionPageRequested.set(1);
  }

  openControls(a: Attention): void {
    void this.router.navigate(['/cumplimiento', 'controles'], { queryParams: { servicio: a.serviceId } });
  }
}
