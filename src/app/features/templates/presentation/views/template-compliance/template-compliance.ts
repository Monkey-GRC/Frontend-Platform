import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TemplateService } from '@features/templates/domain/services/template.service';
import {
  TemplateFullTree,
  TemplateTreeControl,
  TemplateTreeRisk,
} from '@features/templates/domain/models/template.models';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import {
  ControlChecksDetail,
  DashboardControl,
  DashboardSummary,
} from '@features/dashboard/domain/models/dashboard.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { SuccessResponse } from '@shared/domain/models/api-response.model';

interface CategoryView {
  risk: TemplateTreeRisk;
  controls: TemplateTreeControl[];
  controlsOk: number;
  controlsTotal: number;
}

@Component({
  selector: 'app-template-compliance',
  imports: [LoaderComponent, DecimalPipe],
  templateUrl: './template-compliance.html',
  styleUrl: './template-compliance.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCompliance implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateService = inject(TemplateService);
  private readonly dashboardService = inject(DashboardService);

  private readonly templateId = this.route.snapshot.paramMap.get('id')!;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly template = signal<TemplateFullTree | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly complianceByControlId = signal<Map<string, DashboardControl>>(
    new Map()
  );
  readonly categories = signal<CategoryView[]>([]);

  readonly expandedCategoryIds = signal<Set<string>>(new Set());
  readonly expandedControlIds = signal<Set<string>>(new Set());
  readonly checksByControlId = signal<Map<string, ControlChecksDetail>>(
    new Map()
  );
  readonly loadingChecksControlId = signal<string | null>(null);

  ngOnInit(): void {
    this.isLoading.set(true);
    forkJoin({
      template: this.templateService.getFullTree(this.templateId),
      summaryResp: this.dashboardService.readSummary(),
      controlsResp: this.dashboardService.readControls(),
    }).subscribe({
      next: ({ template, summaryResp, controlsResp }) => {
        this.template.set(template);
        this.summary.set(
          (summaryResp as SuccessResponse<DashboardSummary>).data ?? null
        );

        const byId = new Map<string, DashboardControl>();
        for (const control of (
          controlsResp as SuccessResponse<DashboardControl[]>
        ).data ?? []) {
          byId.set(control.id, control);
        }
        this.complianceByControlId.set(byId);

        this.categories.set(this.buildCategories(template.risks));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudo cargar el estado de cumplimiento de este framework.'
        );
        this.isLoading.set(false);
      },
    });
  }

  private buildCategories(risks: TemplateTreeRisk[]): CategoryView[] {
    return risks.map((risk) => {
      const controls = risk.reasons.flatMap((reason) => reason.controls);
      const controlsOk = controls.filter(
        (c) => this.complianceFor(c.id)?.compliance === 100
      ).length;
      return {
        risk,
        controls,
        controlsOk,
        controlsTotal: controls.length,
      };
    });
  }

  categoryDescription(description: string | null): string | null {
    if (!description) return null;
    const cleaned = description.replace(/\s*\([A-Z]+\d+(\.\d+)?(-[A-Z]*\d+(\.\d+)?)?\)\.?/, '').trim();
    return cleaned || null;
  }

  readinessLabel(percent: number | null): string {
    if (percent === null) return 'Sin evaluar todavía';
    if (percent >= 90) return 'Preparado';
    if (percent >= 50) return 'Casi listo';
    return 'Requiere trabajo';
  }

  readinessClass(percent: number | null): string {
    if (percent === null) return 'text-gray-400 dark:text-gray-500';
    if (percent >= 90) return 'text-success-600 dark:text-success-400';
    if (percent >= 50) return 'text-warning-600 dark:text-warning-400';
    return 'text-error-600 dark:text-error-400';
  }

  readinessDotClass(percent: number | null): string {
    if (percent === null) return 'bg-gray-300 dark:bg-gray-600';
    if (percent >= 90) return 'bg-success-500';
    if (percent >= 50) return 'bg-warning-500';
    return 'bg-error-500';
  }

  complianceFor(controlId: string): DashboardControl | undefined {
    return this.complianceByControlId().get(controlId);
  }

  compliancePercentLabel(controlId: string): string {
    const compliance = this.complianceFor(controlId)?.compliance;
    return compliance === null || compliance === undefined
      ? 'Sin evaluar'
      : `${Math.round(compliance)}%`;
  }

  complianceBarClass(controlId: string): string {
    const compliance = this.complianceFor(controlId)?.compliance;
    if (compliance === null || compliance === undefined)
      return 'bg-gray-300 dark:bg-gray-600';
    if (compliance >= 100) return 'bg-success-500';
    if (compliance >= 60) return 'bg-warning-500';
    return 'bg-error-500';
  }

  toggleCategory(riskId: string): void {
    const next = new Set(this.expandedCategoryIds());
    next.has(riskId) ? next.delete(riskId) : next.add(riskId);
    this.expandedCategoryIds.set(next);
  }

  isCategoryExpanded(riskId: string): boolean {
    return this.expandedCategoryIds().has(riskId);
  }

  toggleControl(control: TemplateTreeControl): void {
    const next = new Set(this.expandedControlIds());
    if (next.has(control.id)) {
      next.delete(control.id);
      this.expandedControlIds.set(next);
      return;
    }
    next.add(control.id);
    this.expandedControlIds.set(next);

    if (this.checksByControlId().has(control.id)) return;
    this.loadingChecksControlId.set(control.id);
    this.dashboardService.readControlChecks(control.id).subscribe({
      next: (resp) => {
        const data = (resp as SuccessResponse<ControlChecksDetail>).data;
        if (data) {
          const next = new Map(this.checksByControlId());
          next.set(control.id, data);
          this.checksByControlId.set(next);
        }
        this.loadingChecksControlId.set(null);
      },
      error: () => {
        this.loadingChecksControlId.set(null);
      },
    });
  }

  isControlExpanded(controlId: string): boolean {
    return this.expandedControlIds().has(controlId);
  }

  controlTypeLabel(type: string): string {
    switch (type) {
      case 'AUTOMATIC':
        return 'Validación automática';
      case 'HYBRID':
        return 'Híbrido';
      default:
        return 'Evidencia manual';
    }
  }

  checkResultLabel(result: string): string {
    switch (result) {
      case 'passed':
        return 'Cumple';
      case 'failed':
        return 'No cumple';
      default:
        return 'No aplica';
    }
  }

  checkResultClass(result: string): string {
    switch (result) {
      case 'passed':
        return 'text-success-600 dark:text-success-400';
      case 'failed':
        return 'text-error-600 dark:text-error-400';
      default:
        return 'text-gray-400 dark:text-gray-500';
    }
  }

  goToGrc(): void {
    this.router.navigateByUrl(`/templates/${this.templateId}/grc`);
  }
}
