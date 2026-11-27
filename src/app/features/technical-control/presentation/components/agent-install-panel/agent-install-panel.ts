import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription, switchMap, take, takeWhile, timer } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { AgentInstallOption, AgentInstallReveal, AgentInstallState, Asset, Execution } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';

type Busy = 'start' | 'reveal' | 'regenerate' | 'check';

const STATE_POLL_MS = 3000;
const CONNECTION_POLL_MS = 5000;
const CHECK_POLL_MS = 3000;
// «Comprobar ahora» espera hasta ~3 minutos a que el trabajador lea la sonda; si tarda más, la pantalla avisa y deja de mirar (la lectura sigue en curso).
const CHECK_MAX_POLLS = 60;

// Instalar la sonda en un servidor del cliente (D112). Cuatro momentos: empezar → esperar unos segundos mientras Monkey prepara la clave → mostrar el comando
// UNA vez → esperar a que el servidor se conecte. El comando lleva la clave del servidor: solo vive en la memoria de esta pantalla, nunca en el almacenamiento
// del navegador, y se descarta al salir. La API manda: aquí no se inventa ningún estado.
@Component({
  selector: 'app-agent-install-panel',
  imports: [TranslatePipe, Skeleton, SkeletonRegion],
  templateUrl: './agent-install-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentInstallPanel implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly asset = input.required<Asset>();
  readonly changed = output<Asset>();

  readonly state = signal<AgentInstallState | null>(null);
  readonly loading = signal(true);
  // Solo en memoria. Nunca se guarda ni se registra: es la clave del servidor.
  readonly reveal = signal<AgentInstallReveal | null>(null);
  readonly busy = signal<Busy | null>(null);
  readonly confirmingRegenerate = signal(false);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);
  readonly copied = signal<number | null>(null);

  private statePolling: Subscription | null = null;
  private connectionPolling: Subscription | null = null;
  private checkPolling: Subscription | null = null;

  readonly status = computed(() => this.state()?.status ?? null);
  readonly connected = computed(() => this.asset().agent?.status === 'connected');
  readonly versionLabel = computed(() => this.state()?.os_version.label ?? this.asset().agent?.os_version.label ?? '');
  // Hasta cuándo se puede pedir el comando (la clave caduca), en el idioma de la sesión.
  readonly expiresAt = computed(() => {
    const at = this.state()?.expires_at;
    return at ? new Intl.DateTimeFormat(this.language.current(), { timeStyle: 'short' }).format(new Date(at)) : null;
  });
  // Dónde está el servidor una vez entregado el comando. `waiting`: Monkey lo busca solo; `expired`: pasó el plazo sin verlo conectarse; `disconnected`: estuvo conectado y dejó de reportar.
  readonly phase = computed<'connected' | 'disconnected' | 'waiting' | 'expired' | null>(() => {
    if (this.connected()) return 'connected';
    if (this.status() !== 'delivered' && this.reveal() === null) return null;
    if (this.asset().agent?.status === 'disconnected') return 'disconnected';
    return (this.state()?.connection.watching ?? true) ? 'waiting' : 'expired';
  });
  // Mientras Monkey prepara la clave o el servidor aún no se conecta, la pantalla sigue mirando sola.
  readonly waitingConnection = computed(() => this.phase() === 'waiting');
  // «Última revisión»: la última lectura que Monkey guardó de este servidor, en el idioma de la sesión.
  readonly lastReview = computed(() => {
    const at = this.asset().agent?.last_sync_at ?? this.state()?.connection.last_sync_at;
    return formatLocalDate(at, this.language.current(), { time: true }) || null;
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.reveal.set(null));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.agentInstall(this.asset().id).subscribe({
      next: (state) => this.applyState(state, true),
      error: (error) => {
        this.loading.set(false);
        this.message.set(this.explain(error));
      },
    });
  }

  start(): void {
    this.run('start', () => this.api.startAgentInstall(this.asset().id));
  }

  // «Generar de nuevo»: retira el agente anterior y el comando viejo deja de servir. Pide confirmación porque no se puede deshacer.
  regenerate(): void {
    this.confirmingRegenerate.set(false);
    this.reveal.set(null);
    this.run('regenerate', () => this.api.regenerateAgentInstall(this.asset().id));
  }

  // Mostrar el comando es un POST que lo gasta: solo se pide al pulsar, nunca por sí solo.
  showCommand(): void {
    this.busy.set('reveal');
    this.message.set(null);
    this.api.revealAgentInstall(this.asset().id).subscribe({
      next: (reveal) => {
        this.busy.set(null);
        this.reveal.set(reveal);
        this.state.update((s) => (s ? { ...s, status: 'delivered', expires_at: null } : s));
        this.followConnection();
      },
      error: (error) => {
        this.busy.set(null);
        // «Ya se mostró o caducó»: se vuelve a leer el estado para ofrecer generar uno nuevo.
        if (apiErrorCode(error) === 'AGENT_INSTALL_NOT_READY') {
          this.message.set({ kind: 'info', text: this.translate.instant('TECHNICAL_CONTROL.AGENT.NOT_READY') });
          this.load();
          return;
        }
        this.message.set(this.explain(error));
      },
    });
  }

  copy(index: number, option: AgentInstallOption): void {
    if (option.kind !== 'command') return;
    navigator.clipboard?.writeText(option.value).then(
      () => {
        this.copied.set(index);
        setTimeout(() => this.copied.update((i) => (i === index ? null : i)), 1800);
      },
      () => undefined,
    );
  }

  download(option: AgentInstallOption): void {
    if (option.kind !== 'file') return;
    const url = URL.createObjectURL(new Blob([option.content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = option.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // «Comprobar ahora»: pide una lectura ya, sin esperar a la próxima pasada, y mira cómo termina. Es el atajo de lo que Monkey hace solo: nunca es obligatorio.
  checkNow(): void {
    this.busy.set('check');
    this.message.set(null);
    this.api.evaluate(this.asset().id).subscribe({
      next: () => this.followCheck(),
      error: (error) => {
        this.busy.set(null);
        this.message.set(this.explain(error, 'TECHNICAL_CONTROL.AGENT.CHECK_IN_PROGRESS'));
      },
    });
  }

  private run(kind: Busy, step: () => ReturnType<TechnicalControlService['startAgentInstall']>): void {
    this.busy.set(kind);
    this.message.set(null);
    step().subscribe({
      next: (state) => {
        this.busy.set(null);
        this.applyState(state, false);
        // «Generar de nuevo» devuelve al servidor a «esperando»: la tarjeta tiene que enterarse para no seguir mostrándolo desconectado.
        if (kind === 'regenerate') this.refreshAsset();
      },
      error: (error) => {
        this.busy.set(null);
        this.message.set(this.explain(error));
      },
    });
  }

  private applyState(state: AgentInstallState, firstLoad: boolean): void {
    this.state.set(state);
    this.loading.set(false);
    if (state.status === 'preparing') this.followState();
    // Si el comando ya se entregó (p. ej. se recargó la pantalla), se sigue esperando a que el servidor se conecte.
    else if (state.status === 'delivered' && firstLoad && state.connection.watching) this.followConnection();
  }

  // Mira el estado cada 3 s mientras Monkey prepara la clave (unos segundos); se detiene sola al terminar o al salir.
  private followState(): void {
    this.statePolling?.unsubscribe();
    this.statePolling = timer(STATE_POLL_MS, STATE_POLL_MS)
      .pipe(
        switchMap(() => this.api.agentInstall(this.asset().id)),
        takeWhile((s) => s.status === 'preparing', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (s) => this.state.set(s), error: () => undefined });
  }

  // Después de mostrar el comando, mira cada 5 s si el servidor ya se conectó.
  private followConnection(): void {
    this.connectionPolling?.unsubscribe();
    this.connectionPolling = timer(CONNECTION_POLL_MS, CONNECTION_POLL_MS)
      .pipe(
        switchMap(() => this.api.getAsset(this.asset().id)),
        takeWhile((a) => a.agent?.status !== 'connected', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (a) => this.changed.emit(a), error: () => undefined });
  }

  // Mira cada 3 s cómo termina la lectura que se pidió con «Comprobar ahora». Termina sola: al cerrar la lectura, al pasar ~3 minutos o al salir de la pantalla.
  private followCheck(): void {
    this.checkPolling?.unsubscribe();
    let settled = false;
    this.checkPolling = timer(CHECK_POLL_MS, CHECK_POLL_MS)
      .pipe(
        switchMap(() => this.api.lastExecution(this.asset().id)),
        takeWhile((x) => !x || x.status === 'queued' || x.status === 'running', true),
        take(CHECK_MAX_POLLS),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (x) => {
          if (x && x.status !== 'queued' && x.status !== 'running') {
            settled = true;
            this.finishCheck(x);
          }
        },
        error: () => this.busy.set(null),
        complete: () => {
          if (settled) return;
          this.busy.set(null);
          this.message.set({ kind: 'info', text: this.translate.instant('TECHNICAL_CONTROL.AGENT.CHECK_SLOW') });
        },
      });
  }

  private finishCheck(execution: Execution): void {
    this.busy.set(null);
    if (execution.status === 'completed') {
      this.refreshAsset();
      this.api.agentInstall(this.asset().id).subscribe({ next: (s) => this.state.set(s), error: () => undefined });
      return;
    }
    // El motivo ya viene traducido por el backend (nunca el mensaje de la sonda).
    this.message.set({ kind: 'error', text: execution.failure_message || this.translate.instant('TECHNICAL_CONTROL.AGENT.CHECK_FAILED') });
  }

  private refreshAsset(): void {
    this.api.getAsset(this.asset().id).subscribe({ next: (a) => this.changed.emit(a), error: () => undefined });
  }

  private explain(error: unknown, inProgressKey = 'TECHNICAL_CONTROL.AGENT.IN_PROGRESS'): { kind: 'error' | 'info'; text: string } {
    const code = apiErrorCode(error);
    if (code === 'AGENT_INSTALL_UNAVAILABLE') return { kind: 'info', text: this.translate.instant('TECHNICAL_CONTROL.AGENT.UNAVAILABLE') };
    if (code === 'EXECUTION_IN_PROGRESS') return { kind: 'info', text: this.translate.instant(inProgressKey) };
    return { kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.AGENT.ERROR')) };
  }
}
