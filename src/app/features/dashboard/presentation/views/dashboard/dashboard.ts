import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import { DashboardSummary } from '@features/dashboard/domain/models/dashboard.models';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { getPercentBarClass, getPercentTextClass } from '@shared/domain/utils/dimension-display.util';

@Component({
  selector: 'app-dashboard',
  imports: [LoaderComponent, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly noTemplates = signal(false);

  readonly generalCompliance = computed(() => {
    const templates = this.summary()?.contractedTemplates ?? [];
    const withResults = templates.filter((t) => t.compliance !== null);
    if (withResults.length === 0) return null;
    return Math.round((withResults.reduce((sum, t) => sum + (t.compliance ?? 0), 0) / withResults.length) * 100) / 100;
  });

  readonly getPercentBarClass = getPercentBarClass;
  readonly getPercentTextClass = getPercentTextClass;

  ngOnInit(): void {
    this.readDashboard();
  }

  readDashboard(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.noTemplates.set(false);

    this.templateService.getAll().subscribe({
      next: (templates) => {
        if (templates.length === 0) {
          this.noTemplates.set(true);
          this.isLoading.set(false);
          return;
        }
        this.dashboardService.readSummary(templates[0].id).subscribe({
          next: (resp) => {
            this.summary.set((resp as SuccessResponse<DashboardSummary>).data ?? null);
            this.isLoading.set(false);
          },
          error: (err: HttpErrorResponse) => {
            this.isLoading.set(false);
            this.loadError.set(err.status === 503 ? 'Wazuh no disponible.' : 'No se pudo cargar el resumen.');
          },
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('No se pudo cargar el resumen.');
      },
    });
  }

  goToFramework(templateId: string): void {
    this.router.navigate(['/templates', templateId]);
  }
}
