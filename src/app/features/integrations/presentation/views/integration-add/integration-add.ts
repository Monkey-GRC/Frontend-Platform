import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationCatalog } from '@features/integrations/presentation/components/integration-catalog/integration-catalog';
import { IntegrationConnectModal } from '@features/integrations/presentation/components/integration-connect-modal/integration-connect-modal';

// «Agregar integración» (solo administrador): el catálogo único de integraciones. Conectar pide el servicio y sigue por el asistente de conexión de ese servicio.
@Component({
  selector: 'app-integration-add',
  imports: [PageHeader, TranslatePipe, IntegrationCatalog, IntegrationConnectModal],
  templateUrl: './integration-add.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationAddView {
  readonly picking = signal<CatalogIntegration | null>(null);
}
