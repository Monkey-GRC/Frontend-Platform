import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { ConnectionWizardShell } from '../connection-wizard-shell/connection-wizard-shell';
import { ConnectServerForm } from '../connect-server-form/connect-server-form';

// El recorrido de un servidor (Linux, Windows) dentro del asistente a pantalla completa (D113). Declarar el servidor es UNA pantalla: nombre, versión del sistema y
// criticidad. La instalación de la sonda, con el comando que Monkey entrega UNA vez, ocurre en el detalle de la conexión (`openConnection`), donde se ve cómo va.
// Recibe lo mismo que el resto de recorridos (`components/connection-flows.ts`); `resume` no se usa: un servidor nunca queda «a medias» en el asistente, sino en su detalle.
@Component({
  selector: 'app-server-connection-flow',
  imports: [ConnectionWizardShell, ConnectServerForm, TranslatePipe],
  template: `
    <app-connection-wizard-shell titleKey="TECHNICAL_CONTROL.CONNECT.TITLE" [titleParams]="{ name: platform().name }" [showFooter]="false" (closed)="closed.emit()">
      <p class="mb-5 text-sm text-ink-muted" data-server-intro>{{ 'TECHNICAL_CONTROL.CONNECT.SUBTITLE_SERVER' | translate }}</p>
      <app-connect-server-form [catalogCode]="catalogCode" [platform]="platform()" [service]="service()" [otherServices]="otherServices()" [criticalities]="criticalities()"
        (created)="openConnection.emit($event)" (cancelled)="closed.emit()" />
    </app-connection-wizard-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerConnectionFlow {
  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  readonly resume = input<Asset | null>(null);

  readonly closed = output<void>();
  readonly openConnection = output<Asset>();

  // La categoría (`ac_04`…) es la del tramo de la ruta del asistente: el mismo recorrido sirve a cualquier categoría de sistema operativo.
  protected readonly catalogCode = inject(ActivatedRoute).snapshot.paramMap.get('catalog') ?? '';
}
