import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ServiceService } from '@features/services/domain/services/service.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Asset, TechnicalControlState } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { AssetCard } from '../../components/asset-card/asset-card';

type Stage = 'loading' | 'error' | 'ready';

// El detalle de una conexión: cómo está conectada y, sobre todo, los activos que Monkey encontró a través de ella.
@Component({
  selector: 'app-connection-detail',
  imports: [AssetCard, RouterLink, LoadingSpinner],
  templateUrl: './connection-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionDetailView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogs = inject(CatalogService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly assetId = signal('');
  readonly serviceName = signal('');
  readonly asset = signal<Asset | null>(null);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly criticalities = signal<CatalogOption[]>([]);
  readonly frequencyOptions = signal<CatalogOption[]>([]);

  readonly probeMode = computed(() => this.state()?.probe_mode ?? 'unavailable');
  readonly label = computed(() => this.state()?.applicable_capabilities.find((c) => c.catalog_code === this.asset()?.connection_category)?.category ?? 'Conexión');
  // Frecuencias que admite la conexión, según el catálogo: «6-24 h» → cada 6 o 24 horas; el resto, continua.
  readonly frequencies = computed(() => {
    const base = this.state()?.applicable_capabilities.find((c) => c.catalog_code === this.asset()?.connection_category)?.base_frequency ?? '';
    const wanted = base.includes('6-24') ? ['every_6h', 'every_24h'] : ['continuous'];
    return this.frequencyOptions().filter((f) => wanted.includes(f.value));
  });

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.assetId.set(this.route.snapshot.paramMap.get('assetId') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({
      asset: this.api.getAsset(this.assetId()),
      state: this.api.state(this.serviceId()),
      service: this.services.get(this.serviceId()),
      criticalities: this.catalogs.options('asset_criticality'),
      frequencies: this.catalogs.options('schedule_frequency'),
    }).subscribe({
      next: ({ asset, state, service, criticalities, frequencies }) => {
        this.asset.set(asset);
        this.state.set(state);
        this.serviceName.set(service.name);
        this.criticalities.set(criticalities);
        this.frequencyOptions.set(frequencies);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  onChanged(asset: Asset): void {
    this.asset.set(asset);
  }

  onRemoved(): void {
    this.router.navigate(['/services', this.serviceId()]);
  }
}
