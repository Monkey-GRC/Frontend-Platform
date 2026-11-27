import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, map } from 'rxjs';
import { Asset } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { isUuid } from '@shared/domain/utils/uuid';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { MICROSOFT_ASSET_PARAM, MICROSOFT_ERROR_PARAM, MICROSOFT_HANDLE_PARAM, microsoftReturnErrorKey } from '@features/technical-control/domain/utils/microsoft-return';

// Donde aterriza el navegador al volver de Microsoft (`/integraciones/microsoft`). No muestra un recorrido propio: con la sesión de quien empezó, termina el enlace y devuelve al
// asistente en el paso que toca. El recibo sale de la dirección y del historial (`replaceUrl`). Si no hay a qué conexión volver, lo dice y lleva a Integraciones.
@Component({
  selector: 'app-microsoft-return-view',
  imports: [EmptyState, RouterLink, TranslatePipe, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (problemKey(); as key) {
      <app-empty-state icon="" titleKey="TECHNICAL_CONTROL.WIZARD.M365.RETURN.TITLE" [descriptionKey]="key">
        <a action routerLink="/integraciones" class="mk-btn" data-back-to-integrations>{{ 'TECHNICAL_CONTROL.WIZARD.M365.RETURN.BACK' | translate }}</a>
      </app-empty-state>
    } @else {
      <app-skeleton-region data-returning><div class="space-y-4"><app-skeleton shape="title" width="50%" /><app-skeleton shape="line" [lines]="2" /></div></app-skeleton-region>
    }
  `,
})
export class MicrosoftReturnView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);

  readonly problemKey = signal<string | null>(null);

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const assetId = query.get(MICROSOFT_ASSET_PARAM);
    const handle = query.get(MICROSOFT_HANDLE_PARAM);
    const error = query.get(MICROSOFT_ERROR_PARAM);
    if (!assetId || !isUuid(assetId)) {
      this.problemKey.set(microsoftReturnErrorKey(error ?? 'expired'));
      return;
    }
    // Sin recibo (o si ya no vale) se vuelve al paso de autorizar con el motivo.
    const finish$ = !error && handle ? this.api.completeMicrosoftConsent(assetId, handle).pipe(map((asset) => ({ asset, error: null as string | null }))) : null;
    const read$ = (reason: string) => this.api.getAsset(assetId).pipe(map((asset) => ({ asset, error: reason as string | null })));
    (finish$ ? finish$.pipe(catchError(() => read$('expired'))) : read$(error ?? 'cancelled')).subscribe({
      next: ({ asset, error: reason }) => this.backToWizard(asset, reason),
      error: () => this.problemKey.set(microsoftReturnErrorKey('unavailable')),
    });
  }

  private backToWizard(asset: Asset, error: string | null): void {
    const serviceId = asset.services[0]?.id;
    if (!serviceId) {
      this.problemKey.set(microsoftReturnErrorKey('unavailable'));
      return;
    }
    void this.router.navigate(['/services', serviceId, 'connections', 'new', asset.connection_category, asset.platform], {
      queryParams: { assetId: asset.id, ...(error ? { [MICROSOFT_ERROR_PARAM]: error } : {}) },
      replaceUrl: true,
    });
  }
}
