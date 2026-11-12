import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { forkJoin } from 'rxjs';
import { ServiceService } from '@shared/domain/services/service.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Breadcrumb, Crumb } from '@shared/presentation/components/breadcrumb/breadcrumb';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Asset, Capability, Platform } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { ConnectAssetForm } from '../../components/connect-asset-form/connect-asset-form';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';

type Stage = 'loading' | 'error' | 'ready';

// El paso a paso de UNA plataforma (D67): `/services/:id/connections/new/:catalog/:platform`. Si la plataforma no existe en esa conexión, no aplica al servicio
// o está bloqueada, se vuelve al marketplace: nadie llega aquí a conectar algo que no se puede.
@Component({
  selector: 'app-connect-platform',
  imports: [Breadcrumb, ConnectAssetForm, ProviderLogo, LoadingSpinner, TranslatePipe, EmptyState],
  templateUrl: './connect-platform.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectPlatformView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly service = signal<{ id: string; name: string } | null>(null);
  readonly otherServices = signal<{ id: string; name: string }[]>([]);
  readonly capability = signal<Capability | null>(null);
  readonly platform = signal<Platform | null>(null);
  readonly criticalities = signal<CatalogOption[]>([]);

  // Mis servicios › {servicio} › Nueva conexión › {plataforma}
  readonly crumbs = computed<Crumb[]>(() => [
    { label: this.translate.instant('SHELL.NAV.MY_SERVICES'), link: ['/services'] },
    { label: this.service()?.name ?? this.translate.instant('TECHNICAL_CONTROL.CRUMB_SERVICE'), link: ['/services', this.serviceId()] },
    { label: this.translate.instant('TECHNICAL_CONTROL.NEW_CONNECTION'), link: ['/services', this.serviceId(), 'connections', 'new'] },
    { label: this.platform()?.name ?? '…' },
  ]);

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni perder lo escrito.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.stage() === 'ready') this.catalogs.options('asset_criticality').subscribe((c) => this.criticalities.set(c));
      });
    });
  }

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    const catalog = this.route.snapshot.paramMap.get('catalog');
    const code = this.route.snapshot.paramMap.get('platform');
    forkJoin({ state: this.api.state(id), service: this.services.get(id), list: this.services.list(), criticalities: this.catalogs.options('asset_criticality') }).subscribe({
      next: ({ state, service, list, criticalities }) => {
        const capability = state.applicable_capabilities.find((c) => c.catalog_code === catalog) ?? null;
        const platform = capability?.platforms.find((p) => p.code === code) ?? null;
        if (!capability || !platform || platform.availability !== 'available') {
          this.backToMarketplace();
          return;
        }
        this.capability.set(capability);
        this.platform.set(platform);
        this.service.set({ id: service.id, name: service.name });
        this.otherServices.set(list.items.filter((s) => s.id !== id).map((s) => ({ id: s.id, name: s.name })));
        this.criticalities.set(criticalities);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  onCreated(asset: Asset): void {
    this.router.navigate(['/services', this.serviceId(), 'connections', asset.id]);
  }

  backToMarketplace(): void {
    this.router.navigate(['/services', this.serviceId(), 'connections', 'new']);
  }
}
