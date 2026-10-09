import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Asset } from '../../../domain/models/technical-control.models';

const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: 'Pendiente de comprobar', chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  validated: { label: 'Conexión comprobada', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  active: { label: 'Activa', chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  scheduled: { label: 'Programada', chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: 'No pudimos conectar', chip: 'bg-red-50 text-error-600 dark:bg-red-900/20' },
};

// Las conexiones de un servicio: cada una es un camino por el que Monkey llega a los activos del cliente. Al abrir una se ven los activos que encontró.
@Component({
  selector: 'app-connections-list',
  imports: [RouterLink],
  templateUrl: './connections-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsList {
  readonly serviceId = input.required<string>();
  readonly assets = input.required<Asset[]>();
  readonly labels = input<Record<string, string>>({});

  status(a: Asset) {
    return STATUS[a.provisioning.connection_status] ?? STATUS['pending'];
  }

  kind(a: Asset): string {
    return this.labels()[a.connection_category] ?? 'Conexión';
  }

  detail(a: Asset): string {
    if (a.connection_category === 'ac_01' && a.external_account_id) {
      const regions = (a.provisioning.regions ?? []).join(', ');
      return `AWS · cuenta ${a.external_account_id}${regions ? ` · ${regions}` : ''}`;
    }
    return [a.platform, a.ip_address, a.location].filter(Boolean).join(' · ');
  }
}
