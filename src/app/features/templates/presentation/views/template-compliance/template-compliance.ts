import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { Template } from '@features/templates/domain/models/template.models';
import { ManualChecklist } from '@features/templates/presentation/components/manual-checklist/manual-checklist';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import {
  ControlChecksDetail,
  ControlCheckDetail,
  DashboardControl,
  DashboardSummary,
} from '@features/dashboard/domain/models/dashboard.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import {
  DimensionSlot,
  fillAllDimensions,
  getDimensionMeta,
  getDimensionSlotBadgeClasses,
  getDimensionSlotBadgeLabel,
  getDimensionSlotCardClasses,
  getDimensionSlotIconWrapClasses,
  getPercentBarClass,
  getPercentTextClass,
} from '@shared/domain/utils/dimension-display.util';

@Component({
  selector: 'app-template-compliance',
  imports: [LoaderComponent, DecimalPipe, ManualChecklist],
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
  readonly template = signal<Template | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly allControls = signal<DashboardControl[]>([]);

  /** Solo los controles que NO cumplen al 100% (incluye "sin evaluar" = null) — filosofía de excepción. */
  readonly failingControls = computed(() =>
    this.allControls().filter((c) => c.compliance !== 100),
  );

  readonly expandedControlIds = signal<Set<string>>(new Set());
  readonly expandedDimensionKeys = signal<Set<string>>(new Set());
  readonly checksByControlId = signal<Map<string, ControlChecksDetail>>(new Map());
  readonly loadingChecksControlId = signal<string | null>(null);

  ngOnInit(): void {
    this.isLoading.set(true);
    forkJoin({
      template: this.templateService.getById(this.templateId),
      summaryResp: this.dashboardService.readSummary(this.templateId),
      controlsResp: this.dashboardService.readControls(this.templateId),
    }).subscribe({
      next: ({ template, summaryResp, controlsResp }) => {
        this.template.set(template);
        this.summary.set((summaryResp as SuccessResponse<DashboardSummary>).data ?? null);
        this.allControls.set((controlsResp as SuccessResponse<DashboardControl[]>).data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el estado de cumplimiento de este framework.');
        this.isLoading.set(false);
      },
    });
  }

  dimensionSlotsFor(control: DashboardControl): DimensionSlot[] {
    return fillAllDimensions(control.dimensions);
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

  toggleControl(control: DashboardControl): void {
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
          const map = new Map(this.checksByControlId());
          map.set(control.id, data);
          this.checksByControlId.set(map);
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

  private dimensionKey(controlId: string, dimension: string): string {
    return `${controlId}::${dimension}`;
  }

  toggleDimension(controlId: string, slot: DimensionSlot): void {
    if (!slot.data) return; // "No aplica" no se expande
    const key = this.dimensionKey(controlId, slot.dimension);
    const next = new Set(this.expandedDimensionKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.expandedDimensionKeys.set(next);
  }

  isDimensionExpanded(controlId: string, dimension: string): boolean {
    return this.expandedDimensionKeys().has(this.dimensionKey(controlId, dimension));
  }

  /** Checks fallidos de ESTA dimensión, para el control ya cargado (solo dimensiones con checks automáticos, ej. Servidor). */
  failingChecksFor(controlId: string, dimension: string): ControlCheckDetail[] {
    const detail = this.checksByControlId().get(controlId);
    if (!detail) return [];
    return detail.checks.filter((c) => c.dimension === dimension && c.result === 'failed');
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

  goToPlantilla(): void {
    this.router.navigateByUrl(`/plantilla/${this.templateId}`);
  }

  readonly getDimensionMeta = getDimensionMeta;
  readonly getDimensionSlotCardClasses = getDimensionSlotCardClasses;
  readonly getDimensionSlotIconWrapClasses = getDimensionSlotIconWrapClasses;
  readonly getDimensionSlotBadgeClasses = getDimensionSlotBadgeClasses;
  readonly getDimensionSlotBadgeLabel = getDimensionSlotBadgeLabel;
  readonly getPercentBarClass = getPercentBarClass;
  readonly getPercentTextClass = getPercentTextClass;
}
