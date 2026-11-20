import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { forkJoin } from 'rxjs';
import { ServiceService } from '@shared/domain/services/service.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Breadcrumb, Crumb } from '@shared/presentation/components/breadcrumb/breadcrumb';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Asset, TechnicalControlState } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { AssetCard } from '../../components/asset-card/asset-card';
import { categoryLabel } from '@shared/domain/utils/category-label';
import { platformsByCode } from '@shared/domain/utils/platform-label';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

type Stage = 'loading' | 'error' | 'ready';

// El detalle de una conexión: cómo está conectada y, sobre todo, los activos que Monkey encontró a través de ella.
@Component({
  selector: 'app-connection-detail',
  imports: [AssetCard, RouterLink, Breadcrumb, EmptyState, TranslatePipe, Skeleton, SkeletonRegion],
  templateUrl: './connection-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionDetailView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly assetId = signal('');
  readonly serviceName = signal('');
  readonly asset = signal<Asset | null>(null);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly criticalities = signal<CatalogOption[]>([]);
  readonly frequencyOptions = signal<CatalogOption[]>([]);

  // Mis servicios › {servicio} › {conexión}
  readonly crumbs = computed<Crumb[]>(() => [
    { label: this.translate.instant('SHELL.NAV.MY_SERVICES'), link: ['/services'] },
    { label: this.serviceName() || this.translate.instant('TECHNICAL_CONTROL.CRUMB_SERVICE'), link: ['/services', this.serviceId()] },
    { label: this.asset()?.name ?? this.translate.instant('TECHNICAL_CONTROL.CRUMB_CONNECTION') },
  ]);

  readonly platforms = computed(() => platformsByCode(this.state()));
  readonly probeMode = computed(() => this.state()?.probe_mode ?? 'unavailable');
  readonly label = computed(() => {
    const capability = this.state()?.applicable_capabilities.find((c) => c.catalog_code === this.asset()?.connection_category);
    return capability ? categoryLabel(this.translate, capability.catalog_code, capability.category) : this.translate.instant('TECHNICAL_CONTROL.CRUMB_CONNECTION');
  });
  // Frecuencias que admite la conexión, según el catálogo: «6-24 h» → cada 6 o 24 horas; el resto, continua.
  readonly frequencies = computed(() => {
    const base = this.state()?.applicable_capabilities.find((c) => c.catalog_code === this.asset()?.connection_category)?.base_frequency ?? '';
    const wanted = base.includes('6-24') ? ['every_6h', 'every_24h'] : ['continuous'];
    return this.frequencyOptions().filter((f) => wanted.includes(f.value));
  });

  constructor() {
    // El backend traduce los catálogos y los pasos de la conexión: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.stage() !== 'ready') return;
        this.catalogs.options('asset_criticality').subscribe((c) => this.criticalities.set(c));
        this.catalogs.options('schedule_frequency').subscribe((f) => this.frequencyOptions.set(f));
        this.api.getAsset(this.assetId()).subscribe((a) => this.asset.set(a));
      });
    });
  }

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
    this.toast.showSuccess(this.translate.instant('TECHNICAL_CONTROL.CARD.REMOVED', { name: this.asset()?.name ?? '' }));
    this.router.navigate(['/services', this.serviceId()]);
  }
}
