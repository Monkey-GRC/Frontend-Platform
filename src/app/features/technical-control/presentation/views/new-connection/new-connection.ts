import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ServiceService } from '@features/services/domain/services/service.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset, TechnicalControlState } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { ConnectAssetForm } from '../../components/connect-asset-form/connect-asset-form';

type Stage = 'loading' | 'error' | 'ready';

// Crear una conexión: Monkey propone los métodos que aplican al servicio (según dónde vive) y guía el que el cliente elija.
@Component({
  selector: 'app-new-connection',
  imports: [ConnectAssetForm, RouterLink],
  templateUrl: './new-connection.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewConnectionView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogs = inject(CatalogService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly service = signal<{ id: string; name: string } | null>(null);
  readonly otherServices = signal<{ id: string; name: string }[]>([]);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly criticalities = signal<CatalogOption[]>([]);

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    forkJoin({ state: this.api.state(id), service: this.services.get(id), list: this.services.list(), criticalities: this.catalogs.options('asset_criticality') }).subscribe({
      next: ({ state, service, list, criticalities }) => {
        // Sin escenario no hay conexiones que proponer: se vuelve al servicio, donde se le pregunta.
        if (!state.deployment_scenario) {
          this.router.navigate(['/services', id]);
          return;
        }
        this.state.set(state);
        this.service.set({ id: service.id, name: service.name });
        this.otherServices.set(list.items.filter((s) => s.id !== id && s.technical_control.deployment_scenario).map((s) => ({ id: s.id, name: s.name })));
        this.criticalities.set(criticalities);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  onCreated(asset: Asset): void {
    this.router.navigate(['/services', this.serviceId(), 'connections', asset.id]);
  }

  cancel(): void {
    this.router.navigate(['/services', this.serviceId()]);
  }
}
