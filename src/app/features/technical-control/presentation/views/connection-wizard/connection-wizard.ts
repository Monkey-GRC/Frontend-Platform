import { ChangeDetectionStrategy, Component, OnInit, ViewContainerRef, effect, inject, inputBinding, outputBinding, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceService } from '@shared/domain/services/service.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { resumeStep } from '@shared/domain/utils/connection-resume';
import { safeReturnUrl } from '@shared/domain/utils/safe-return-url';
import { isUuid } from '@shared/domain/utils/uuid';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { ConnectionWizardShell } from '../../components/connection-wizard-shell/connection-wizard-shell';
import { connectionFlow } from '../../components/connection-flows';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

// El asistente a pantalla completa de una plataforma (`services/:id/connections/new/:catalog/:platform`, fuera del shell de la app). Carga lo que el recorrido necesita y lo entrega
// al flujo de la plataforma. Si la plataforma no existe en esa conexión o aún no está disponible, vuelve al catálogo de conexiones: nadie llega aquí a conectar algo que no se puede.
// Al cerrar vuelve de donde vino (`?returnTo=`, una ruta interna): el detalle de una integración, el catálogo o, sin más datos, el servicio.
// `?assetId=` retoma una conexión que quedó a medias: se lee el activo del servidor y el asistente abre en el paso que toca. Un id que no es un uuid, de otro servicio o de otra plataforma, o
// de una conexión que ya no está pendiente, se ignora y se vuelve al detalle de esa conexión (o al servicio si no existe).
@Component({
  selector: 'app-connection-wizard-view',
  imports: [ConnectionWizardShell, EmptyState, TranslatePipe, Skeleton, SkeletonRegion],
  templateUrl: './connection-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionWizardView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);

  private readonly flowHost = viewChild('flowHost', { read: ViewContainerRef });

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly service = signal<{ id: string; name: string } | null>(null);
  readonly otherServices = signal<{ id: string; name: string }[]>([]);
  readonly platform = signal<Platform | null>(null);
  readonly criticalities = signal<CatalogOption[]>([]);
  readonly resume = signal<Asset | null>(null);

  constructor() {
    // Abre el recorrido de la plataforma (`components/connection-flows.ts`) cuando todo está cargado: el mismo punto para cualquier plataforma.
    effect(() => {
      const host = this.flowHost();
      const platform = this.platform();
      const ready = this.stage() === 'ready';
      untracked(() => {
        host?.clear();
        const flow = platform ? connectionFlow(platform.code) : null;
        if (!host || !ready || !flow) return;
        host.createComponent(flow, {
          bindings: [
            inputBinding('platform', () => platform),
            inputBinding('service', this.service),
            inputBinding('otherServices', this.otherServices),
            inputBinding('criticalities', this.criticalities),
            inputBinding('resume', this.resume),
            outputBinding('closed', () => this.close()),
            outputBinding('openConnection', (asset: Asset) => this.openConnection(asset)),
          ],
        });
      });
    });

    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear el asistente ni perder lo escrito.
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
    const assetId = this.route.snapshot.queryParamMap.get('assetId');
    const asset$: Observable<Asset | null> = assetId === null ? of(null) : isUuid(assetId) ? this.api.getAsset(assetId).pipe(catchError(() => of(null))) : of(null);
    forkJoin({ state: this.api.state(id), service: this.services.get(id), list: this.services.list(), criticalities: this.catalogs.options('asset_criticality'), asset: asset$ }).subscribe({
      next: ({ state, service, list, criticalities, asset }) => {
        const platform = state.applicable_capabilities.find((c) => c.catalog_code === catalog)?.platforms.find((p) => p.code === code) ?? null;
        if (!platform || platform.availability !== 'available' || !connectionFlow(platform.code)) {
          void this.router.navigate(['/services', id, 'connections', 'new']);
          return;
        }
        if (assetId !== null) {
          const resumable = asset && asset.platform === platform.code && asset.connection_category === catalog && asset.services.some((s) => s.id === id) && resumeStep(asset) !== null;
          if (!resumable) {
            void this.router.navigate(asset ? ['/services', id, 'connections', asset.id] : ['/services', id]);
            return;
          }
          this.resume.set(asset);
        }
        this.platform.set(platform);
        this.service.set({ id: service.id, name: service.name });
        this.otherServices.set(list.items.filter((s) => s.id !== id).map((s) => ({ id: s.id, name: s.name })));
        this.criticalities.set(criticalities);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  close(): void {
    const fallback = this.router.createUrlTree(['/services', this.serviceId()]).toString();
    void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnTo'), fallback));
  }

  openConnection(asset: Asset): void {
    void this.router.navigate(['/services', this.serviceId(), 'connections', asset.id]);
  }
}
