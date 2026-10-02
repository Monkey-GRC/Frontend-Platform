import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Asset, Capability } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';

interface CredentialField {
  key: string;
  label: string;
  help?: string;
  secret?: boolean;
  multiline?: boolean;
}

// Qué datos pide cada conexión, dichos sin jerga. Siempre de solo lectura: Monkey nunca modifica nada.
const CLOUD_FIELDS: CredentialField[] = [
  { key: 'account_id', label: 'Identificador de la cuenta o suscripción', help: 'Por ejemplo, el número de cuenta de AWS o el ID de suscripción de Azure.' },
  { key: 'read_only_role', label: 'Rol o aplicación de solo lectura', help: 'Crea un rol que solo pueda leer la configuración y pega aquí su identificador.' },
];
const DATABASE_FIELDS: CredentialField[] = [
  { key: 'db_user', label: 'Usuario de solo lectura', help: 'Crea un usuario que solo pueda leer: Monkey nunca escribe en tu base de datos.' },
  { key: 'db_password', label: 'Contraseña de ese usuario', secret: true },
];
const SSH_FIELDS: CredentialField[] = [
  { key: 'ssh_user', label: 'Usuario para conectarse' },
  { key: 'ssh_private_key', label: 'Llave privada', help: 'Pega el contenido completo de la llave.', secret: true, multiline: true },
];
const CREDENTIALS: Record<string, CredentialField[]> = { ac_01: CLOUD_FIELDS, ac_03: DATABASE_FIELDS, ac_05: DATABASE_FIELDS };
const AGENT_OR_SSH = ['ac_02', 'ac_04'];
const AGENT_ONLY_NOTE = 'Instalarás un programa ligero de Monkey en el equipo. No necesitas dar contraseñas.';

type Stage = 'type' | 'details';

// Registra un sistema que el cliente quiere que Monkey evalúe. Dos pasos cortos: qué tipo de
// conexión es y sus datos. Las credenciales se piden solo aquí, se guardan cifradas y no se
// vuelven a mostrar.
@Component({
  selector: 'app-connect-asset-form',
  imports: [OptionChips],
  templateUrl: './connect-asset-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectAssetForm {
  private readonly api = inject(TechnicalControlService);

  readonly capabilities = input.required<Capability[]>();
  readonly service = input.required<{ id: string; name: string }>();
  // Otros servicios de la empresa a los que este sistema también podría dar soporte.
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);

  readonly created = output<Asset>();
  readonly cancelled = output<void>();

  readonly stage = signal<Stage>('type');
  readonly category = signal<string | null>(null);
  readonly name = signal('');
  readonly platform = signal<string | null>(null);
  readonly ip = signal('');
  readonly location = signal('');
  readonly criticality = signal('medium');
  readonly extraServiceIds = signal<string[]>([]);
  readonly method = signal<'agent' | 'ssh'>('agent');
  readonly secrets = signal<Partial<Record<string, string>>>({});
  readonly showHints = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly selected = computed(() => this.capabilities().find((c) => c.catalog_code === this.category()) ?? null);
  readonly platformChips = computed<ChipOption[]>(() => (this.selected()?.supported_platforms ?? []).map((p) => ({ value: p, label: p })));
  readonly criticalityChips = computed<ChipOption[]>(() => this.criticalities().map((c) => ({ value: c.value, label: c.label })));
  readonly methodChips: ChipOption[] = [
    { value: 'agent', label: 'Instalar el agente de Monkey (recomendado)' },
    { value: 'ssh', label: 'Acceso por SSH' },
  ];
  readonly agentNote = AGENT_ONLY_NOTE;

  // Los campos de credenciales que corresponden a la conexión y al método elegido.
  readonly credentialFields = computed<CredentialField[]>(() => {
    const code = this.category();
    if (!code) return [];
    if (AGENT_OR_SSH.includes(code)) return this.method() === 'ssh' ? SSH_FIELDS : [];
    return CREDENTIALS[code] ?? [];
  });
  readonly usesAgentChoice = computed(() => AGENT_OR_SSH.includes(this.category() ?? ''));
  readonly agentOnly = computed(() => this.category() === 'ac_06' || (this.usesAgentChoice() && this.method() === 'agent'));

  readonly valid = computed(
    () =>
      !!this.name().trim() &&
      !!this.platform() &&
      this.credentialFields().every((f) => (this.secrets()[f.key] ?? '').trim().length > 0),
  );

  choose(code: string): void {
    this.category.set(code);
    this.platform.set(null);
    this.method.set('agent');
    this.secrets.set({});
    this.stage.set('details');
  }

  back(): void {
    this.stage.set('type');
    this.error.set(null);
  }

  setSecret(key: string, value: string): void {
    this.secrets.update((s) => ({ ...s, [key]: value }));
  }

  toggleService(id: string): void {
    this.extraServiceIds.update((list) => (list.includes(id) ? list.filter((i) => i !== id) : [...list, id]));
  }

  fieldError(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }

  submit(): void {
    if (!this.valid()) {
      this.showHints.set(true);
      return;
    }
    const code = this.category()!;
    const credentials: Record<string, string> = {};
    for (const f of this.credentialFields()) credentials[f.key] = (this.secrets()[f.key] ?? '').trim();
    if (this.usesAgentChoice()) credentials['connection_method'] = this.method();

    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.api
      .createAsset({
        name: this.name().trim(),
        connection_category: code,
        platform: this.platform()!,
        ip_address: this.ip().trim() || null,
        location: this.location().trim() || null,
        criticality: this.criticality(),
        service_ids: [this.service().id, ...this.extraServiceIds()],
        ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
      })
      .subscribe({
        next: (asset) => {
          this.saving.set(false);
          this.created.emit(asset);
        },
        error: (error) => {
          this.saving.set(false);
          this.showError(error);
        },
      });
  }

  private showError(error: unknown): void {
    const code = apiErrorCode(error);
    if (code === 'CAPABILITY_NOT_APPLICABLE' || code === 'DEPLOYMENT_SCENARIO_NOT_SET') {
      const service = error instanceof HttpErrorResponse ? error.error?.error?.service : null;
      this.error.set(
        code === 'CAPABILITY_NOT_APPLICABLE'
          ? `Esta conexión no aplica al escenario de ${service ? `«${service}»` : 'uno de los servicios elegidos'}. Quítalo de la lista o elige otra conexión.`
          : `Primero cuéntanos dónde vive ${service ? `«${service}»` : 'ese servicio'}.`,
      );
      return;
    }
    const fields = apiFieldErrors(error);
    if (fields.length > 0) {
      this.fieldErrors.set(Object.fromEntries(fields.map((f) => [f.field.replace(/^credentials\./, ''), f.message])));
      this.error.set('Revisa los datos marcados y vuelve a intentarlo.');
      return;
    }
    this.error.set(apiErrorMessage(error, 'No pudimos registrar el sistema. Inténtalo de nuevo.'));
  }
}
