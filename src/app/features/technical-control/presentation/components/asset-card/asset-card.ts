import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, Execution, ProbeMode } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { AssetEditForm } from '../asset-edit-form/asset-edit-form';
import { CloudConnectionPanel } from '../cloud-connection-panel/cloud-connection-panel';
import { DiscoveredAssets } from '../discovered-assets/discovered-assets';

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
  imports: [AssetEditForm, CloudConnectionPanel, DiscoveredAssets],
  templateUrl: './asset-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetCard implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly destroyRef = inject(DestroyRef);

  readonly asset = input.required<Asset>();
  readonly connectionLabel = input('');
  readonly probeMode = input<ProbeMode>('unavailable');
  // Frecuencias que admite esta conexión y sus etiquetas.
  readonly frequencies = input<CatalogOption[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  readonly changed = output<Asset>();
  readonly removed = output<string>();

  // Editar y quitar: el sistema se puede corregir o dar de baja en cualquier momento (no solo mientras se conecta).
  readonly editing = signal(false);
  // Con la conexión ya comprobada, el cliente puede volver a ver los datos que dio a AWS (ExternalId, identidad de Monkey, plantilla).
  readonly showSetup = signal(false);
  readonly confirmingRemove = signal(false);
  readonly removing = signal(false);

  readonly busy = signal<Busy | null>(null);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);

  readonly status = computed(() => STATUS[this.asset().provisioning.connection_status] ?? STATUS['pending']);
  readonly step = computed(() => this.asset().provisioning.connection_status);
  readonly demo = computed(
    () => this.probeMode() === 'simulated' && this.asset().provisioning.is_active && this.asset().operational_status === 'warning',
  );

  // ---- cuenta de nube (D58) ----
  readonly isCloud = computed(() => this.asset().connection_category === 'ac_01');
  readonly connected = computed(() => ['validated', 'active', 'scheduled'].includes(this.step()));
  // El rol de solo lectura se configura en la cuenta del cliente: mientras no esté comprobado, se le guía paso a paso.
  readonly needsRolePanel = computed(() => this.asset().connection_setup?.method === 'readonly_role' && ['pending', 'failed'].includes(this.step()));
  readonly canShowSetup = computed(() => this.asset().connection_setup?.method === 'readonly_role' && !this.needsRolePanel());
  readonly keysWarning = computed(() => {
    const s = this.asset().connection_setup;
    return s?.method === 'access_keys' && ['pending', 'failed'].includes(this.step()) ? (s.warning ?? null) : null;
  });
  // La comprobación contra la cuenta real (D58): se dice, para que nadie confunda esto con la demostración.
  readonly verified = computed(() => this.isCloud() && this.probeMode() === 'runner' && this.connected());
  readonly regions = computed(() => (this.asset().provisioning.regions ?? []).join(', '));

  // «Evaluar ahora»: solo se muestra su ESTADO (en cola → en curso → completada o fallida). Los resultados son otra pantalla.
  readonly execution = signal<Execution | null>(null);
  readonly evaluating = signal(false);
  readonly executionText = computed(() => {
    const e = this.execution();
    if (!e) return null;
    switch (e.status) {
      case 'queued': return { icon: 'schedule', tone: 'info', text: 'En cola: empezará en unos segundos.' };
      case 'running': return { icon: 'progress_activity', tone: 'info', text: 'Evaluando tu cuenta de AWS… puede tardar unos minutos.' };
      case 'completed': return { icon: 'task_alt', tone: 'ok', text: 'Evaluación completada.' };
      case 'cancelled': return { icon: 'block', tone: 'warn', text: 'La evaluación se canceló. Puedes lanzarla de nuevo.' };
      default: return { icon: 'error', tone: 'error', text: e.failure_message ?? 'No pudimos completar la evaluación. Inténtalo de nuevo.' };
    }
  });
  readonly executionOpen = computed(() => ['queued', 'running'].includes(this.execution()?.status ?? ''));

  ngOnInit(): void {
    if (!this.isCloud() || !this.connected()) return;
    // Si ya hay una evaluación, se muestra su estado (y se sigue si aún corre).
    this.api.lastExecution(this.asset().id).subscribe((e) => {
      this.execution.set(e);
      if (e && ['queued', 'running'].includes(e.status)) this.follow();
    });
  }

  onEdited(asset: Asset): void {
    this.editing.set(false);
    this.message.set(null);
    this.changed.emit(asset);
  }

  remove(): void {
    this.removing.set(true);
    this.message.set(null);
    this.api.removeAsset(this.asset().id).subscribe({
      next: () => {
        this.removing.set(false);
        this.removed.emit(this.asset().id);
      },
      error: (error) => {
        this.removing.set(false);
        this.confirmingRemove.set(false);
        this.message.set({ kind: 'error', text: apiErrorMessage(error, 'No pudimos quitar el activo. Inténtalo de nuevo.') });
      },
    });
  }

  evaluate(): void {
    this.evaluating.set(true);
    this.message.set(null);
    this.api.evaluate(this.asset().id).subscribe({
      next: (e) => {
        this.evaluating.set(false);
        this.execution.set({ ...e, queued_at: null, finished_at: null, failure_reason: null, failure_message: null });
        this.follow();
      },
      error: (error) => {
        this.evaluating.set(false);
        this.message.set({ kind: 'error', text: apiErrorMessage(error, 'No pudimos iniciar la evaluación. Inténtalo de nuevo.') });
      },
    });
  }

  // Mira el estado cada 3 s mientras la evaluación está abierta; se detiene sola al terminar o al salir de la pantalla.
  private follow(): void {
    timer(3000, 3000)
      .pipe(
        switchMap(() => this.api.lastExecution(this.asset().id)),
        takeWhile((e) => !e || ['queued', 'running'].includes(e.status), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.execution.set(e));
  }

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
        text: `${detail || 'No pudimos conectar con tu cuenta.'} Revisa los datos y vuelve a intentarlo.`,
      };
    }
    return { kind: 'error', text: apiErrorMessage(error, 'No pudimos completar este paso. Inténtalo de nuevo.') };
  }
}
