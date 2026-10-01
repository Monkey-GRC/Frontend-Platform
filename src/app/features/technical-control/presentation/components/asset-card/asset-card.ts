import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, ProbeMode } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';

const STATUS: Record<string, { label: string; chip: string; icon: string }> = {
  pending: { label: 'Pendiente de comprobar', chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', icon: 'schedule' },
  validated: { label: 'Conexión comprobada', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: 'task_alt' },
  active: { label: 'Activa', chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: 'bolt' },
  scheduled: { label: 'Programada', chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: 'event_repeat' },
  failed: { label: 'No pudimos conectar', chip: 'bg-red-50 text-error-600 dark:bg-red-900/20', icon: 'error' },
};

type Busy = 'validate' | 'activate' | 'schedule';

// Un sistema conectado y lo que se puede hacer con él según en qué paso va: comprobar la
// conexión → activar → programar. Habla de «evaluación automática», nunca de proveedores.
@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetCard {
  private readonly api = inject(TechnicalControlService);

  readonly asset = input.required<Asset>();
  readonly connectionLabel = input('');
  readonly probeMode = input<ProbeMode>('unavailable');
  // Frecuencias que admite esta conexión y sus etiquetas.
  readonly frequencies = input<CatalogOption[]>([]);
  readonly changed = output<Asset>();

  readonly busy = signal<Busy | null>(null);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);

  readonly status = computed(() => STATUS[this.asset().provisioning.connection_status] ?? STATUS['pending']);
  readonly step = computed(() => this.asset().provisioning.connection_status);
  readonly demo = computed(
    () => this.probeMode() === 'simulated' && this.asset().provisioning.is_active && this.asset().operational_status === 'warning',
  );

  frequencyLabel(value: string | null): string {
    return this.frequencies().find((f) => f.value === value)?.label ?? value ?? '';
  }

  validate(): void {
    this.run('validate', () => this.api.validate(this.asset().id));
  }

  activate(): void {
    this.run('activate', () => this.api.activate(this.asset().id));
  }

  schedule(frequency: string): void {
    this.run('schedule', () => this.api.schedule(this.asset().id, frequency));
  }

  // Ejecuta un paso y vuelve a leer el sistema: la API manda, la pantalla solo la muestra.
  private run(kind: Busy, step: () => Observable<unknown>): void {
    this.busy.set(kind);
    this.message.set(null);
    step().subscribe({
      next: () => this.refresh(),
      error: (error) => {
        this.message.set(this.explain(error));
        // Una validación fallida cambia el estado del sistema («failed»): se refleja de inmediato.
        if (kind === 'validate' && apiErrorCode(error) === 'CONNECTION_FAILED') this.refresh();
        else this.busy.set(null);
      },
    });
  }

  private refresh(): void {
    this.api.getAsset(this.asset().id).subscribe({
      next: (asset) => {
        this.busy.set(null);
        this.changed.emit(asset);
      },
      error: () => this.busy.set(null),
    });
  }

  private explain(error: unknown): { kind: 'error' | 'info'; text: string } {
    const code = apiErrorCode(error);
    // Sin evaluación automática en esta cuenta no es un error del cliente: se le explica con calma.
    if (code === 'CONNECTION_UNAVAILABLE') return { kind: 'info', text: apiErrorMessage(error, '') };
    if (code === 'CONNECTION_FAILED') {
      const detail = apiFieldErrors(error).map((f) => f.message).join(' ');
      return {
        kind: 'error',
        text: `${detail || 'No pudimos conectar con el sistema.'} Revisa los datos y vuelve a intentarlo.`,
      };
    }
    return { kind: 'error', text: apiErrorMessage(error, 'No pudimos completar este paso. Inténtalo de nuevo.') };
  }
}
