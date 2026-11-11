import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LanguageService } from '@core/domain/services/language.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { ComplianceServiceRef } from '@features/compliance/domain/models/compliance.models';
import { OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { OverviewService } from '@features/compliance/domain/services/overview.service';

interface Row {
  service: ComplianceServiceRef;
  /** El marco en este servicio. `null` si el resumen del servicio no se pudo leer. */
  framework: OverviewFramework | null;
}

// «General»: para cada marco, cómo va CADA servicio que lo tiene contratado. No hay un porcentaje que junte servicios (la unidad es servicio × marco, §9, D68):
// cada fila trae el estado, el avance y la cobertura de ese servicio, y lleva a su detalle (controles, riesgos, causas, evidencias…).
@Component({
  selector: 'app-compliance-general',
  imports: [RouterLink, TranslatePipe, StatusIndicator, DataTable, TableCell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-ink">{{ 'COMPLIANCE.ENTRY.GENERAL_TITLE' | translate }}</h1>
    <p class="mt-1 text-sm text-ink-muted">{{ 'COMPLIANCE.ENTRY.GENERAL_BODY' | translate }}</p>

    @if (loading()) {
      <div class="mt-6 flex justify-center py-10" role="status">
        <span class="material-symbols-rounded animate-spin text-[28px] text-action" aria-hidden="true">progress_activity</span>
        <span class="sr-only">{{ 'COMMON.LOADING' | translate }}</span>
      </div>
    } @else {
      <!-- Una sola tabla agrupada por marco: cada fila es un servicio con su propio estado, avance y cobertura (nunca uno combinado). -->
      @if (rows().length) {
        <div class="mt-6">
          <app-data-table captionKey="COMPLIANCE.ENTRY.GENERAL_TABLE" [columns]="columns" [rows]="rows()" [rowKey]="rowKey" [rowLabel]="rowLabel" [clickable]="true" [focusable]="false"
            [chevron]="true" [groupBy]="frameworkOf" [groupLabel]="frameworkName" (rowClick)="open($event.service.id)">
            <ng-template appCell="service" let-r>
              <a [routerLink]="['/cumplimiento', 'resumen']" [queryParams]="{ servicio: r.service.id }" data-service-row class="font-medium text-ink hover:underline">{{ r.service.name }}</a>
              @if (!r.framework) {
                <span class="block text-xs text-ink-muted">{{ 'COMPLIANCE.ENTRY.ROW_ERROR' | translate }}</span>
              }
            </ng-template>
            <ng-template appCell="status" let-r>
              @if (r.framework; as f) {
                @let look = readinessLook(f.readiness);
                <app-status-indicator [tone]="look.tone" [labelKey]="look.labelKey" [hintKey]="look.hintKey" [attr.data-status]="look.level" />
              }
            </ng-template>
            <!-- Avance y cobertura juntos y junto al estado; el avance informa, no decide. -->
            <ng-template appCell="progress" let-r>
              @if (r.framework; as f) {
                <div class="min-w-[12rem]">
                  <p class="text-sm font-medium text-ink" data-progress>{{ 'COMPLIANCE.CONTROLS.PROGRESS_VALUE' | translate: { percent: pct(f.progress.done, f.progress.total), done: f.progress.done, total: f.progress.total } }}</p>
                  <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-tint-strong" aria-hidden="true">
                    <div class="h-full rounded-full bg-action" [style.width.%]="percentOf(f.progress.done, f.progress.total) ?? 0"></div>
                  </div>
                  <p class="mt-1 text-xs text-ink-muted">{{ 'COMPLIANCE.CONTROLS.COVERAGE' | translate: { percent: pct(f.coverage.measured, f.coverage.applicable), measured: f.coverage.measured, applicable: f.coverage.applicable } }}</p>
                </div>
              }
            </ng-template>
          </app-data-table>
        </div>
      }

      @if (withoutFramework().length) {
        <section class="mt-6" [attr.aria-label]="'COMPLIANCE.ENTRY.NO_FRAMEWORK' | translate">
          <h2 class="mb-3 text-base font-semibold text-ink">{{ 'COMPLIANCE.ENTRY.NO_FRAMEWORK' | translate }}</h2>
          <app-data-table captionKey="COMPLIANCE.ENTRY.NO_FRAMEWORK" [columns]="plainColumns" [rows]="withoutFramework()" [rowKey]="serviceKey" [rowLabel]="serviceLabel" [clickable]="true" [focusable]="false"
            (rowClick)="open($event.id)">
            <ng-template appCell="service" let-s>
              <a [routerLink]="['/cumplimiento', 'resumen']" [queryParams]="{ servicio: s.id }" class="font-medium text-ink hover:underline">{{ s.name }}</a>
            </ng-template>
          </app-data-table>
        </section>
      }
    }
  `,
})
export class ComplianceGeneral implements OnInit {
  protected readonly readinessLook = readinessLook;
  private readonly overview = inject(OverviewService);
  private readonly view = inject(ComplianceViewService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  readonly services = input.required<ComplianceServiceRef[]>();

  protected readonly loading = signal(true);
  protected readonly rows = signal<Row[]>([]);
  protected readonly percentOf = percentOf;

  protected readonly columns: TableColumn<Row>[] = [
    { key: 'service', headerKey: 'COMPLIANCE.ENTRY.COL_SERVICE' },
    { key: 'status', headerKey: 'COMPLIANCE.ENTRY.COL_STATUS' },
    { key: 'progress', headerKey: 'COMPLIANCE.ENTRY.COL_PROGRESS' },
  ];
  protected readonly plainColumns: TableColumn<ComplianceServiceRef>[] = [{ key: 'service', headerKey: 'COMPLIANCE.ENTRY.COL_SERVICE' }];
  protected readonly rowKey = (r: Row): string => `${r.framework?.framework_code ?? ''}:${r.service.id}`;
  protected readonly rowLabel = (r: Row): string => r.service.name;
  protected readonly serviceKey = (s: ComplianceServiceRef): string => s.id;
  protected readonly serviceLabel = (s: ComplianceServiceRef): string => s.name;
  /** Una sección por marco, en el orden en que aparece; dentro, un servicio por fila. */
  protected readonly frameworkOf = (r: Row): string => r.framework?.framework_code ?? '';
  protected readonly frameworkName = (code: string, rows: Row[]): string => rows[0]?.framework?.name ?? code;

  protected open(serviceId: string): void {
    void this.router.navigate(['/cumplimiento', 'resumen'], { queryParams: { servicio: serviceId } });
  }

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
      this.rows.set(lists.flat().filter((r) => !!r.framework?.framework_code));
      this.loading.set(false);
    });
  }

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  protected pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }
}
