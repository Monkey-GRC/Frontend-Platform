import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { Asset } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { ConnectionProgress } from '../connection-progress/connection-progress';

type Phase = 'idle' | 'saving' | 'checking';

// El paso que el cliente hace en SU cuenta de AWS para dar acceso de solo lectura (D58): descargar la plantilla, crearla, y volver con el rol.
// Aquí no hay credenciales: el cliente comparte un rol que él controla y puede borrar cuando quiera. Los pasos vienen del backend (ya en su idioma).
@Component({
  selector: 'app-cloud-connection-panel',
  imports: [TranslatePipe, ConnectionProgress],
  templateUrl: './cloud-connection-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudConnectionPanel {
  private readonly api = inject(TechnicalControlService);
  private readonly translate = inject(TranslateService);

  readonly asset = input.required<Asset>();
  readonly changed = output<Asset>();

  readonly roleArn = signal('');
  readonly phase = signal<Phase>('idle');
  readonly roleError = signal<string | null>(null);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);
  readonly copied = signal<string | null>(null);
  readonly downloading = signal(false);

  readonly setup = computed(() => this.asset().connection_setup ?? null);
  readonly busy = computed(() => this.phase() !== 'idle');
  readonly narration = computed(() =>
    this.phase() === 'saving' ? this.translate.instant('TECHNICAL_CONTROL.PANEL.SAVING_ROLE') : this.phase() === 'checking' ? this.translate.instant('TECHNICAL_CONTROL.PANEL.CHECKING') : '',
  );
  // Lo que el cliente pega en CloudFormation. Los nombres son los de los parámetros de la plantilla.
  readonly rows = computed(() => {
    const s = this.setup();
    if (!s) return [];
    return [
      { key: 'external_id', label: 'ExternalId', hint: 'TECHNICAL_CONTROL.PANEL.HINT_EXTERNAL_ID', value: s.external_id ?? '' },
      { key: 'principal', label: 'MonkeyPrincipalArn', hint: 'TECHNICAL_CONTROL.PANEL.HINT_PRINCIPAL', value: s.monkey_principal_arn ?? '' },
    ];
  });
  readonly missingPrincipal = computed(() => !this.setup()?.monkey_principal_arn);

  constructor() {
    // Si el cliente ya había guardado un rol, se le muestra; lo que escribe no se pisa.
    effect(() => {
      const saved = this.asset().connection_setup?.role_arn;
      if (saved && !this.roleArn()) this.roleArn.set(saved);
    });
  }

  copy(key: string, value: string): void {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => {
        this.copied.set(key);
        setTimeout(() => this.copied.update((k) => (k === key ? null : k)), 1800);
      },
      () => undefined,
    );
  }

  downloadTemplate(): void {
    this.downloading.set(true);
    this.api.downloadRoleTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'RoleMonkeyReadOnly.yaml';
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: (error) => {
        this.downloading.set(false);
        this.message.set({ kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.DOWNLOAD_ERROR')) });
      },
    });
  }

  // Guarda el rol (si cambió) y comprueba el acceso de verdad. La API manda: la pantalla vuelve a leer el sistema al terminar.
  check(): void {
    const arn = this.roleArn().trim();
    this.roleError.set(null);
    this.message.set(null);
    if (!arn) {
      this.roleError.set(this.translate.instant('TECHNICAL_CONTROL.PANEL.ROLE_REQUIRED'));
      return;
    }
    const saved = this.asset().connection_setup?.role_arn;
    if (arn === saved) {
      this.validate();
      return;
    }
    this.phase.set('saving');
    this.api.setRoleArn(this.asset().id, arn).subscribe({
      next: () => this.validate(),
      error: (error) => {
        this.phase.set('idle');
        const field = apiFieldErrors(error).find((f) => f.field === 'role_arn');
        if (field) this.roleError.set(field.message);
        else this.message.set({ kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.SAVE_ROLE_ERROR')) });
      },
    });
  }

  private validate(): void {
    this.phase.set('checking');
    this.api.validate(this.asset().id).subscribe({
      next: () => this.refresh(),
      error: (error) => {
        const code = apiErrorCode(error);
        if (code === 'CONNECTION_FAILED') {
          // La comprobación fallida cambió el estado del sistema («no pudimos conectar»): se refleja y se dice qué corregir.
          const field = apiFieldErrors(error).find((f) => f.field === 'role_arn');
          this.roleError.set(field?.message ?? apiFieldErrors(error)[0]?.message ?? this.translate.instant('TECHNICAL_CONTROL.PANEL.ACCESS_ERROR'));
          this.refresh();
          return;
        }
        this.phase.set('idle');
        // «No disponible» no es un error del cliente: el rol quedó guardado y puede reintentar en un momento.
        this.message.set({ kind: code === 'CONNECTION_UNAVAILABLE' ? 'info' : 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.CHECK_ERROR')) });
      },
    });
  }

  private refresh(): void {
    this.api.getAsset(this.asset().id).subscribe({
      next: (asset) => {
        this.phase.set('idle');
        this.changed.emit(asset);
      },
      error: () => this.phase.set('idle'),
    });
  }
}
