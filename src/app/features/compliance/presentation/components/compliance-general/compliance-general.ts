import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LanguageService } from '@core/domain/services/language.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { StatusBadge } from '@shared/presentation/components/status-badge/status-badge';
import { ComplianceServiceRef } from '../../../domain/models/compliance.models';
import { OverviewFramework } from '../../../domain/models/overview.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { OverviewService } from '../../../domain/services/overview.service';

interface Row {
  service: ComplianceServiceRef;
  /** El marco en este servicio. `null` si el resumen del servicio no se pudo leer. */
  framework: OverviewFramework | null;
}

interface FrameworkGroup {
  code: string;
  name: string;
  rows: Row[];
}

// «General»: para cada marco, cómo va CADA servicio que lo tiene contratado. No hay un porcentaje que junte servicios (la unidad es servicio × marco, §9, D68):
// cada fila trae el estado, el avance y la cobertura de ese servicio, y lleva a su detalle (controles, riesgos, causas, evidencias…).
@Component({
  selector: 'app-compliance-general',
  imports: [RouterLink, TranslatePipe, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ 'COMPLIANCE.ENTRY.GENERAL_TITLE' | translate }}</h1>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.ENTRY.GENERAL_BODY' | translate }}</p>

    @if (loading()) {
      <div class="mt-6 flex justify-center py-10" role="status">
        <span class="material-symbols-rounded animate-spin text-[28px] text-primary" aria-hidden="true">progress_activity</span>
        <span class="sr-only">{{ 'COMMON.LOADING' | translate }}</span>
      </div>
    } @else {
      @for (g of groups(); track g.code) {
        <section class="mt-6" [attr.aria-label]="g.name" [attr.data-framework]="g.code">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <span class="material-symbols-rounded text-[20px] text-primary" aria-hidden="true">workspace_premium</span>{{ g.name }}
            </h2>
            <p class="text-xs text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.ENTRY.SERVICE_COUNT' | translate: { count: g.rows.length } }}</p>
          </div>
          <ul class="mt-3 mk-card divide-y divide-gray-100 overflow-hidden dark:divide-gray-800">
            @for (r of g.rows; track r.service.id) {
              <li>
                <a [routerLink]="['/services', r.service.id, 'cumplimiento', 'resumen']" data-service-row
                  class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div class="min-w-0 flex-1 basis-56">
                    <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ r.service.name }}</p>
                    @if (r.framework; as f) {
                      <div class="mt-1.5"><app-status-badge [status]="f.readiness" /></div>
                    } @else {
                      <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.ENTRY.ROW_ERROR' | translate }}</p>
                    }
                  </div>
                  @if (r.framework; as f) {
                    <div class="w-full min-w-[14rem] flex-1 basis-72">
                      <div class="flex items-baseline justify-between gap-3">
                        <p class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.CONTROLS.PROGRESS_LABEL' | translate }}</p>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white" data-progress>{{ 'COMPLIANCE.CONTROLS.PROGRESS_VALUE' | translate: { percent: pct(f.progress.done, f.progress.total), done: f.progress.done, total: f.progress.total } }}</p>
                      </div>
                      <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                        <div class="h-full rounded-full bg-primary" [style.width.%]="percentOf(f.progress.done, f.progress.total) ?? 0"></div>
                      </div>
                      <p class="mt-1.5 text-xs text-gray-600 dark:text-gray-300">{{ 'COMPLIANCE.CONTROLS.COVERAGE' | translate: { percent: pct(f.coverage.measured, f.coverage.applicable), measured: f.coverage.measured, applicable: f.coverage.applicable } }}</p>
                    </div>
                  }
                  <span class="material-symbols-rounded text-[20px] text-gray-500" aria-hidden="true">chevron_right</span>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      @if (withoutFramework().length) {
        <section class="mt-6" [attr.aria-label]="'COMPLIANCE.ENTRY.NO_FRAMEWORK' | translate">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ 'COMPLIANCE.ENTRY.NO_FRAMEWORK' | translate }}</h2>
          <ul class="mt-3 mk-card divide-y divide-gray-100 overflow-hidden dark:divide-gray-800">
            @for (s of withoutFramework(); track s.id) {
              <li>
                <a [routerLink]="['/services', s.id, 'cumplimiento']" class="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:text-white dark:hover:bg-gray-800">
                  <span class="truncate">{{ s.name }}</span>
                  <span class="material-symbols-rounded text-[18px] text-gray-500" aria-hidden="true">chevron_right</span>
                </a>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class ComplianceGeneral implements OnInit {
  private readonly overview = inject(OverviewService);
  private readonly view = inject(ComplianceViewService);
  private readonly language = inject(LanguageService);

  readonly services = input.required<ComplianceServiceRef[]>();

  protected readonly loading = signal(true);
  private readonly rows = signal<Row[]>([]);
  protected readonly percentOf = percentOf;

  /** Un grupo por marco, en el orden en que aparece; dentro, un servicio por fila. */
  protected readonly groups = computed<FrameworkGroup[]>(() => {
    const byCode = new Map<string, FrameworkGroup>();
    for (const r of this.rows()) {
      const code = r.framework?.framework_code;
      if (!code || !r.framework) continue;
      const group = byCode.get(code) ?? { code, name: r.framework.name, rows: [] };
      group.rows.push(r);
      byCode.set(code, group);
    }
    return [...byCode.values()];
  });

  /** Servicios que no tienen ningún marco contratado: no hay nada que comparar, pero se puede entrar a ellos. */
  protected readonly withoutFramework = computed(() => this.services().filter((s) => s.frameworks.length === 0));

  ngOnInit(): void {
    const withFramework = this.services().filter((s) => s.frameworks.length > 0);
    if (withFramework.length === 0) {
      this.loading.set(false);
      return;
    }
    const view = this.view.viewParam();
    // Cada servicio se lee por separado: uno que falle no esconde a los demás.
    forkJoin(
      withFramework.map((service) =>
        this.overview.get(service.id, view).pipe(
          map((o): Row[] => (o.frameworks.length ? o.frameworks.map((framework) => ({ service, framework })) : [])),
          catchError(() => of<Row[]>([])),
        ),
      ),
    ).subscribe((lists) => {
      this.rows.set(lists.flat());
      this.loading.set(false);
    });
  }

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  protected pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }
}
