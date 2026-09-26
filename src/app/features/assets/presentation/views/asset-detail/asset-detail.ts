import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AssetService } from '@features/assets/domain/services/asset.service';
import { AssetCompliance, AssetComplianceCheck } from '@features/assets/domain/models/asset.model';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

@Component({
  selector: 'app-asset-detail',
  imports: [LoaderComponent],
  templateUrl: './asset-detail.html',
  styleUrl: './asset-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assetService = inject(AssetService);

  private readonly assetId = this.route.snapshot.paramMap.get('id')!;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly compliance = signal<AssetCompliance | null>(null);
  readonly onlyFailing = signal(false);

  ngOnInit(): void {
    this.assetService.getCompliance(this.assetId).subscribe({
      next: (compliance) => {
        this.compliance.set(compliance);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el cumplimiento de este activo.');
        this.isLoading.set(false);
      },
    });
  }

  get filteredChecks(): AssetComplianceCheck[] {
    const compliance = this.compliance();
    if (!compliance) return [];
    if (!this.onlyFailing()) return compliance.checks;
    return compliance.checks.filter((c) => c.result === 'failed');
  }

  get compliancePercent(): number | null {
    const summary = this.compliance()?.summary;
    if (!summary || !summary.total) return null;
    return Math.round((summary.passed / summary.total) * 100);
  }

  readinessLabel(): string {
    const percent = this.compliancePercent;
    if (percent === null) return 'Sin evaluar todavía';
    if (percent >= 90) return 'Preparado';
    if (percent >= 50) return 'Casi listo';
    return 'Requiere trabajo';
  }

  readinessClass(): string {
    const percent = this.compliancePercent;
    if (percent === null) return 'text-gray-400 dark:text-gray-500';
    if (percent >= 90) return 'text-success-600 dark:text-success-400';
    if (percent >= 50) return 'text-warning-600 dark:text-warning-400';
    return 'text-error-600 dark:text-error-400';
  }

  readinessDotClass(): string {
    const percent = this.compliancePercent;
    if (percent === null) return 'bg-gray-300 dark:bg-gray-600';
    if (percent >= 90) return 'bg-success-500';
    if (percent >= 50) return 'bg-warning-500';
    return 'bg-error-500';
  }

  platformLabel(): string {
    const asset = this.compliance()?.asset;
    if (!asset) return '';
    if (asset.osName && asset.osVersion) return `${asset.osName} ${asset.osVersion}`;
    return asset.osName ?? (asset.os === 'UBUNTU' ? 'Ubuntu' : 'Windows');
  }

  toggleOnlyFailing(): void {
    this.onlyFailing.set(!this.onlyFailing());
  }

  checkResultLabel(result: string | null): string {
    switch (result) {
      case 'passed': return 'Cumple';
      case 'failed': return 'No cumple';
      default: return 'No aplica';
    }
  }

  checkResultClass(result: string | null): string {
    switch (result) {
      case 'passed': return 'text-success-600 dark:text-success-400';
      case 'failed': return 'text-error-600 dark:text-error-400';
      default: return 'text-gray-400 dark:text-gray-500';
    }
  }

  goBack(): void {
    this.router.navigateByUrl('/assets');
  }
}
