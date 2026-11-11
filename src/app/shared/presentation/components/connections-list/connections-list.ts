import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { Asset } from '@shared/domain/models/technical-control.models';

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
  imports: [RouterLink, DataTable, TableCell, StatusIndicator],
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
  ];
  readonly rowKey = (a: Asset): string => a.id;

  readonly serviceId = input.required<string>();
  readonly assets = input.required<Asset[]>();
  readonly labels = input<Record<string, string>>({});

  /** La fila entera abre la conexión; el enlace del nombre hace lo mismo para quien navega con el lector de pantalla. */
  open(a: Asset): void {
    void this.router.navigate(['/services', this.serviceId(), 'connections', a.id]);
  }

  status(a: Asset) {
    return STATUS[a.provisioning.connection_status] ?? STATUS['pending'];
  }

  kind(a: Asset): string {
    return this.labels()[a.connection_category] ?? this.translate.instant('TECHNICAL_CONTROL.CRUMB_CONNECTION');
  }

  detail(a: Asset): string {
    if (a.connection_category === 'ac_01' && a.external_account_id) {
      const regions = (a.provisioning.regions ?? []).join(', ');
      return this.translate.instant('TECHNICAL_CONTROL.AWS_ACCOUNT', { account: a.external_account_id }) + (regions ? ` · ${regions}` : '');
    }
    return [a.platform, a.ip_address, a.location].filter(Boolean).join(' · ');
  }
}
