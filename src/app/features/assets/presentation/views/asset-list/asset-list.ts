import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AssetService } from '@features/assets/domain/services/asset.service';
import { Asset } from '@features/assets/domain/models/asset.model';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import { DashboardServerCompliance } from '@features/dashboard/domain/models/dashboard.models';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

@Component({
  selector: 'app-asset-list',
  imports: [ReactiveFormsModule, LoaderComponent],
  templateUrl: './asset-list.html',
  styleUrl: './asset-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetList implements OnInit {
  private readonly assetService = inject(AssetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly isLoading = signal(false);
  readonly assets = signal<Asset[]>([]);
  readonly complianceByAssetId = signal<Map<string, DashboardServerCompliance>>(new Map());
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: ['SERVER', Validators.required],
    source: ['WAZUH_AGENT', Validators.required],
    externalId: [''],
    os: ['UBUNTU', Validators.required],
  });

  ngOnInit(): void {
    this.readAll();
  }

  readAll(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    forkJoin({
      assetsResp: this.assetService.getAll(),
      serversResp: this.templateService.getAll().pipe(
        switchMap((templates) =>
          templates.length
            ? this.dashboardService.readServers(templates[0].id)
            : of({ statusCode: 200, message: '', data: [] } as SuccessResponse<DashboardServerCompliance[]>),
        ),
      ),
    }).subscribe({
      next: ({ assetsResp, serversResp }) => {
        this.assets.set(assetsResp);
        const byId = new Map<string, DashboardServerCompliance>();
        for (const server of (serversResp as SuccessResponse<DashboardServerCompliance[]>).data ?? []) {
          byId.set(server.assetId, server);
        }
        this.complianceByAssetId.set(byId);
        this.showCreateForm.set(assetsResp.length === 0);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los activos.');
        this.isLoading.set(false);
      },
    });
  }

  readinessLabel(assetId: string): string {
    const compliance = this.complianceByAssetId().get(assetId)?.compliance;
    if (compliance === null || compliance === undefined) return 'Sin evaluar todavía';
    if (compliance >= 90) return 'Preparado';
    if (compliance >= 50) return 'Casi listo';
    return 'Requiere trabajo';
  }

  readinessDotClass(assetId: string): string {
    const compliance = this.complianceByAssetId().get(assetId)?.compliance;
    if (compliance === null || compliance === undefined) return 'bg-gray-300 dark:bg-gray-600';
    if (compliance >= 90) return 'bg-success-500';
    if (compliance >= 50) return 'bg-warning-500';
    return 'bg-error-500';
  }

  platformLabel(asset: Asset): string {
    if (asset.os_name && asset.os_version) return `${asset.os_name} ${asset.os_version}`;
    return asset.os_name ?? (asset.os === 'UBUNTU' ? 'Ubuntu' : 'Windows');
  }

  open(asset: Asset): void {
    this.router.navigateByUrl(`/assets/${asset.id}`);
  }

  toggleCreateForm(): void {
    this.showCreateForm.set(!this.showCreateForm());
  }

  submit(): void {
    if (this.form.invalid) return;
    this.creating.set(true);
    this.errorMessage.set(null);

    const value = this.form.value;
    this.assetService.create({
      name: value.name,
      type: value.type,
      source: value.source,
      externalId: value.source === 'WAZUH_AGENT' ? value.externalId : undefined,
      os: value.os,
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreateForm.set(false);
        this.form.reset({ type: 'SERVER', source: 'WAZUH_AGENT', os: 'UBUNTU' });
        this.readAll();
      },
      error: () => {
        this.creating.set(false);
        this.errorMessage.set('No se pudo registrar el activo.');
      },
    });
  }
}
