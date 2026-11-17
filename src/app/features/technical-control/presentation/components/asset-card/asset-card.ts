import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, Execution, Platform, ProbeMode } from '@shared/domain/models/technical-control.models';
import { canResumeConnection } from '@shared/domain/utils/connection-resume';
import { assetDetail } from '@shared/domain/utils/platform-label';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { AgentInstallPanel } from '../agent-install-panel/agent-install-panel';
import { AssetEditForm } from '../asset-edit-form/asset-edit-form';
import { CloudConnectionPanel } from '../cloud-connection-panel/cloud-connection-panel';
import { ConnectionProgress } from '../connection-progress/connection-progress';
import { DiscoveredAssets } from '../discovered-assets/discovered-assets';
import { ExecutionProgress } from '../execution-progress/execution-progress';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { Busy as BusyDirective } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { Tag } from '@shared/presentation/components/tag/tag';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'TECHNICAL_CONTROL.STATUS.PENDING', tone: 'neutral' },
  validated: { label: 'TECHNICAL_CONTROL.STATUS.VALIDATED', tone: 'ok' },
  active: { label: 'TECHNICAL_CONTROL.STATUS.ACTIVE', tone: 'ok' },
  scheduled: { label: 'TECHNICAL_CONTROL.STATUS.SCHEDULED', tone: 'ok' },
  failed: { label: 'TECHNICAL_CONTROL.STATUS.FAILED', tone: 'bad' },
};

// Un servidor con la sonda (D112) no se «comprueba» como una cuenta de nube: su estado es el del programa instalado.
const AGENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'TECHNICAL_CONTROL.STATUS.AGENT_PENDING', tone: 'neutral' },
  connected: { label: 'TECHNICAL_CONTROL.STATUS.AGENT_CONNECTED', tone: 'ok' },
  disconnected: { label: 'TECHNICAL_CONTROL.STATUS.AGENT_DISCONNECTED', tone: 'warn' },
  removed: { label: 'TECHNICAL_CONTROL.STATUS.AGENT_REMOVED', tone: 'neutral' },
};

type Busy = 'validate' | 'schedule';

// Un sistema conectado y lo que se puede hacer con él según en qué paso va: comprobar la
// conexión → programar (programar activa la conexión). Habla de «evaluación automática», nunca de proveedores.
@Component({
  selector: 'app-asset-card',
  imports: [AgentInstallPanel, BusyDirective, BusyFields, Tag, AssetEditForm, CloudConnectionPanel, ConnectionProgress, DiscoveredAssets, ExecutionProgress, ProviderLogo, RouterLink, StatusIndicator, TranslatePipe],
  templateUrl: './asset-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetCard implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  readonly asset = input.required<Asset>();
  // El servicio desde el que se mira la conexión: los activos que el cliente marca son de ESE servicio.
  readonly serviceId = input.required<string>();
  readonly connectionLabel = input('');
  // Las plataformas del catálogo por código: de ahí salen el nombre y el logo de la plataforma de este activo.
  readonly platforms = input<Record<string, Platform>>({});
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
  private readonly scheduling = signal<string | null>(null);
  // La frecuencia cuyo botón corre ahora; los demás quedan deshabilitados.
  readonly busyFrequency = computed(() => (this.busy() === 'schedule' ? this.scheduling() : null));
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);

  // Un servidor con la sonda instalada (D112): `agent` solo viene en esos activos.
  readonly isAgent = computed(() => !!this.asset().agent);
  readonly status = computed(() => {
    const agent = this.asset().agent;
    if (agent) return AGENT_STATUS[agent.status] ?? AGENT_STATUS['pending'];
    return STATUS[this.asset().provisioning.connection_status] ?? STATUS['pending'];
  });
  readonly step = computed(() => this.asset().provisioning.connection_status);
  readonly demo = computed(
    () => this.probeMode() === 'simulated' && this.asset().provisioning.is_active && this.asset().operational_status === 'warning',
  );

  // ---- cuenta de nube (D58) ----
  readonly isCloud = computed(() => this.asset().connection_category === 'ac_01');
  readonly connected = computed(() => ['validated', 'active', 'scheduled'].includes(this.step()));
  // El rol de solo lectura se configura en la cuenta del cliente: mientras no esté comprobado, se le guía paso a paso.
  readonly resumable = computed(() => canResumeConnection(this.asset()));
  readonly resumeLink = computed(() => ['/services', this.serviceId(), 'connections', 'new', this.asset().connection_category, this.asset().platform ?? '']);
  readonly resumeParams = computed(() => ({ assetId: this.asset().id, returnTo: this.router.url }));
  readonly needsRolePanel = computed(() => this.asset().connection_setup?.method === 'readonly_role' && ['pending', 'failed'].includes(this.step()));
  readonly canShowSetup = computed(() => this.asset().connection_setup?.method === 'readonly_role' && !this.needsRolePanel());
  readonly keysWarning = computed(() => {
    const s = this.asset().connection_setup;
    return s?.method === 'access_keys' && ['pending', 'failed'].includes(this.step()) ? (s.warning ?? null) : null;
  });
  // El logo oficial de la plataforma de este activo (D67), el `logo_key` que trae el catálogo; sin catálogo cargado, sin logo.
  readonly platform = computed(() => this.platforms()[this.asset().platform ?? '']);
  readonly providerLogo = computed(() => this.platform()?.logo_key ?? null);
  readonly detail = computed(() => assetDetail(this.translate, this.asset(), this.platform()));

  // «Evaluar ahora»: solo se muestra su ESTADO (en cola → en curso → completada o fallida). Los resultados son otra pantalla.
  readonly execution = signal<Execution | null>(null);
  readonly evaluating = signal(false);
  readonly executionText = computed(() => {
    const e = this.execution();
    if (!e) return null;
    switch (e.status) {
      case 'queued': return { tone: 'neutral' as StatusTone, text: this.translate.instant('TECHNICAL_CONTROL.EXECUTION.QUEUED') };
      case 'running': return { tone: 'neutral' as StatusTone, text: this.translate.instant('TECHNICAL_CONTROL.EXECUTION.RUNNING') };
      case 'completed': return { tone: 'ok' as StatusTone, text: this.translate.instant('TECHNICAL_CONTROL.EXECUTION.COMPLETED') };
      case 'cancelled': return { tone: 'warn' as StatusTone, text: this.translate.instant('TECHNICAL_CONTROL.EXECUTION.CANCELLED') };
      default: return { tone: 'bad' as StatusTone, text: e.failure_message ?? this.translate.instant('TECHNICAL_CONTROL.EXECUTION.FAILED') };
    }
  });
  // D105 · Lo único que se dice del «corte»: cuándo fue la última revisión automática terminada (fecha y hora). No hay una fecha que fijar ni congelar.
  readonly lastReview = computed(() => {
    const e = this.execution();
    return e?.status === 'completed' && e.finished_at
      ? new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(e.finished_at))
      : null;
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
    if (this.removing()) return;
    this.removing.set(true);
    this.message.set(null);
    this.api.removeAsset(this.asset().id).subscribe({
      // Ocupado hasta que se va a otra pantalla: quien escucha navega y el componente se destruye (D116).
      next: () => this.removed.emit(this.asset().id),
      error: (error) => {
        this.removing.set(false);
        this.confirmingRemove.set(false);
        this.message.set({ kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.CARD.REMOVE_ERROR')) });
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
        this.message.set({ kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.CARD.EVALUATE_ERROR')) });
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

  // Programar activa la conexión si aún no lo está: el cliente no ve un paso «activar» aparte.
  schedule(frequency: string): void {
    if (this.busy() !== null || frequency === this.asset().provisioning.schedule_frequency) return;
    this.scheduling.set(frequency);
    const needsActivation = this.step() === 'validated';
    this.run('schedule', () => (needsActivation ? this.api.activate(this.asset().id).pipe(switchMap(() => this.api.schedule(this.asset().id, frequency))) : this.api.schedule(this.asset().id, frequency)));
  }

  // Ejecuta un paso y vuelve a leer el sistema: la API manda, la pantalla solo la muestra.
  private run(kind: Busy, step: () => Observable<unknown>): void {
    if (this.busy() !== null) return;
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
        text: `${detail || this.translate.instant('TECHNICAL_CONTROL.CARD.CONNECT_ERROR')} ${this.translate.instant('TECHNICAL_CONTROL.CARD.CHECK_DATA')}`,
      };
    }
    return { kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.CARD.STEP_ERROR')) };
  }
}
