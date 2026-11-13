import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { canResumeConnection } from '@shared/domain/utils/connection-resume';
import { assetDetail } from '@shared/domain/utils/platform-label';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { Tag } from '@shared/presentation/components/tag/tag';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'TECHNICAL_CONTROL.STATUS.PENDING', tone: 'neutral' },
  validated: { label: 'TECHNICAL_CONTROL.STATUS.VALIDATED', tone: 'neutral' },
  active: { label: 'TECHNICAL_CONTROL.STATUS.ACTIVE', tone: 'ok' },
  scheduled: { label: 'TECHNICAL_CONTROL.STATUS.SCHEDULED', tone: 'ok' },
  failed: { label: 'TECHNICAL_CONTROL.STATUS.FAILED', tone: 'bad' },
};

// Las conexiones de un servicio: cada una es un camino por el que Monkey llega a los activos del cliente. Al abrir una se ven los activos que encontró.
@Component({
  selector: 'app-connections-list',
  imports: [Tag, RouterLink, DataTable, TableCell, ProviderLogo, StatusIndicator, TranslatePipe],
  templateUrl: './connections-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsList {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly columns: TableColumn<Asset>[] = [
    { key: 'connection', headerKey: 'TECHNICAL_CONTROL.LIST.COL_CONNECTION' },
    { key: 'type', headerKey: 'TECHNICAL_CONTROL.LIST.COL_TYPE' },
    { key: 'detail', headerKey: 'TECHNICAL_CONTROL.LIST.COL_DETAIL' },
    { key: 'status', headerKey: 'TECHNICAL_CONTROL.LIST.COL_STATUS' },
    { key: 'action', headerKey: 'TECHNICAL_CONTROL.LIST.COL_ACTION' },
  ];
  readonly rowKey = (a: Asset): string => a.id;

  readonly serviceId = input.required<string>();
  readonly assets = input.required<Asset[]>();
  readonly labels = input<Record<string, string>>({});
  // Las plataformas del catálogo por código: de ahí salen el nombre y el logo de la plataforma de cada conexión.
  readonly platforms = input<Record<string, Platform>>({});

  /** La fila entera abre la conexión; el enlace del nombre hace lo mismo para quien navega con el lector de pantalla. */
  open(a: Asset): void {
    void this.router.navigate(['/services', this.serviceId(), 'connections', a.id]);
  }

  /** Una conexión a medias se retoma en el paso que toca (se deriva del activo, no se guarda nada en el navegador). */
  canResume = canResumeConnection;

  resumeLink(a: Asset): string[] {
    return ['/services', this.serviceId(), 'connections', 'new', a.connection_category, a.platform ?? ''];
  }

  resumeParams(a: Asset): Record<string, string> {
    return { assetId: a.id, returnTo: this.router.url };
  }

  status(a: Asset) {
    return STATUS[a.provisioning.connection_status] ?? STATUS['pending'];
  }

  kind(a: Asset): string {
    return this.labels()[a.connection_category] ?? this.translate.instant('TECHNICAL_CONTROL.CRUMB_CONNECTION');
  }

  detail(a: Asset): string {
    return assetDetail(this.translate, a, this.platforms()[a.platform ?? '']);
  }

  logoKey(a: Asset): string | null {
    return this.platforms()[a.platform ?? '']?.logo_key ?? null;
  }
}
