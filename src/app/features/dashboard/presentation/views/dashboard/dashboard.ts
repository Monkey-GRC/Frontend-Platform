import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import {
  CheckResult,
  ControlCheckDetail,
  DashboardControl,
  DashboardSummary,
} from '@features/dashboard/domain/models/dashboard.models';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { ManualChecklist } from '@features/templates/presentation/components/manual-checklist/manual-checklist';

@Component({
  selector: 'app-dashboard',
  imports: [LoaderComponent, ManualChecklist],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly isLoading = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly controls = signal<DashboardControl[]>([]);
  readonly wazuhUnavailable = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly expandedControlId = signal<string | null>(null);
  readonly checksByControl = signal<Record<string, ControlCheckDetail[]>>({});
  readonly checksError = signal<Record<string, string>>({});
  readonly loadingChecksId = signal<string | null>(null);
  readonly expandedCheckId = signal<string | null>(null);

  readonly compliantControlsLabel = computed(() => {
    const data = this.summary();
    if (!data) return '';
    return `${data.controlsCompliant} / ${data.controlsTotal}`;
  });

  ngOnInit(): void {
    this.readDashboard();
  }

  readDashboard(): void {
    this.isLoading.set(true);
    this.wazuhUnavailable.set(false);
    this.loadError.set(null);
    this.checksByControl.set({});
    this.checksError.set({});
    this.expandedControlId.set(null);

    forkJoin({
      summary: this.dashboardService.readSummary(),
      controls: this.dashboardService.readControls(),
    }).subscribe({
      next: ({ summary, controls }) => {
        this.summary.set((summary as SuccessResponse<DashboardSummary>).data ?? null);
        this.controls.set((controls as SuccessResponse<DashboardControl[]>).data ?? []);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 503) {
          this.wazuhUnavailable.set(true);
          return;
        }
        this.loadError.set('No se pudo cargar el dashboard.');
      },
    });
  }

  onToggleControl(control: DashboardControl): void {
    const isClosing = this.expandedControlId() === control.id;
    this.expandedControlId.set(isClosing ? null : control.id);
    this.expandedCheckId.set(null);

    if (isClosing || control.type === 'MANUAL' || this.checksByControl()[control.id] || this.checksError()[control.id]) {
      return;
    }

    this.loadingChecksId.set(control.id);

    this.dashboardService.readControlChecks(control.id).subscribe({
      next: (resp) => {
        const checks = (resp as SuccessResponse<{ checks: ControlCheckDetail[] }>).data?.checks ?? [];
        this.checksByControl.update((current) => ({ ...current, [control.id]: checks }));
        this.loadingChecksId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        const message = err.status === 404
          ? 'Control no encontrado o no automático.'
          : err.status === 503
            ? 'Wazuh no disponible.'
            : 'No se pudo cargar el detalle de checks.';
        this.checksError.update((current) => ({ ...current, [control.id]: message }));
        this.loadingChecksId.set(null);
      },
    });
  }

  onToggleCheck(checkId: string): void {
    this.expandedCheckId.update((current) => (current === checkId ? null : checkId));
  }

  getResultBadge(result: CheckResult): { icon: string; iconClasses: string; badgeClasses: string; label: string } {
    switch (result) {
      case 'passed':
        return {
          icon: 'check_circle',
          iconClasses: 'text-success-600 dark:text-success-400',
          badgeClasses: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
          label: 'Cumple',
        };
      case 'failed':
        return {
          icon: 'cancel',
          iconClasses: 'text-error-600 dark:text-error-400',
          badgeClasses: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
          label: 'Fallido',
        };
      default:
        return {
          icon: 'do_not_disturb_on',
          iconClasses: 'text-gray-400 dark:text-gray-500',
          badgeClasses: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
          label: 'No aplica',
        };
    }
  }

  getComplianceColor(percentage: number | null): string {
    if (percentage === null) return 'text-gray-400 dark:text-gray-500';
    if (percentage >= 90) return 'text-success-600 dark:text-success-400';
    if (percentage >= 60) return 'text-warning-600 dark:text-warning-400';
    return 'text-error-600 dark:text-error-400';
  }

  getComplianceBarColor(percentage: number | null): string {
    if (percentage === null) return 'bg-gray-300 dark:bg-gray-600';
    if (percentage >= 90) return 'bg-success-500';
    if (percentage >= 60) return 'bg-warning-500';
    return 'bg-error-500';
  }
}
