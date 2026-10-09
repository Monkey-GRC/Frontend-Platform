import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Asset, Capability, NewAssetInput } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';

interface CredentialField {
  key: string;
  label: string;
  help?: string;
  secret?: boolean;
  multiline?: boolean;
}

// Qué datos pide cada conexión de servidores y bases de datos, dichos sin jerga. Siempre de solo lectura: Monkey nunca modifica nada.
// La nube (ac_01) tiene su propio flujo guiado: canal, cuenta y regiones (más abajo).
const DATABASE_FIELDS: CredentialField[] = [
  { key: 'db_user', label: 'Usuario de solo lectura', help: 'Crea un usuario que solo pueda leer: Monkey nunca escribe en tu base de datos.' },
  { key: 'db_password', label: 'Contraseña de ese usuario', secret: true },
];
const SSH_FIELDS: CredentialField[] = [
  { key: 'ssh_user', label: 'Usuario para conectarse' },
  { key: 'ssh_private_key', label: 'Llave privada', help: 'Pega el contenido completo de la llave.', secret: true, multiline: true },
];
const CREDENTIALS: Record<string, CredentialField[]> = { ac_03: DATABASE_FIELDS, ac_05: DATABASE_FIELDS };
const CLOUD = 'ac_01';
const ACCOUNT_ID = /^\d{12}$/;
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
export class ConnectAssetForm implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);

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

  // Conexión de nube (AWS): canal, cuenta y regiones declaradas. Las opciones salen del backend; la pantalla no las fija.
  readonly cloudMethod = signal<'readonly_role' | 'access_keys'>('readonly_role');
  readonly accountId = signal('');
  readonly regions = signal<string[]>([]);
  readonly accessKeyId = signal('');
  readonly secretAccessKey = signal('');
  private readonly methodOptions = signal<CatalogOption[]>([]);
  private readonly regionOptions = signal<CatalogOption[]>([]);
  readonly isCloud = computed(() => this.category() === CLOUD);
  // «Agente» no es un canal de la nube: se ofrece solo para servidores y equipos.
  readonly cloudMethodOptions = computed(() => this.methodOptions().filter((m) => m.value !== 'agent'));
  readonly regionChips = computed<ChipOption[]>(() => this.regionOptions().map((r) => ({ value: r.value, label: r.label })));
  readonly accountIdValid = computed(() => ACCOUNT_ID.test(this.accountId().trim()));

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

  readonly valid = computed(() => {
    if (!this.name().trim()) return false;
    if (this.isCloud()) {
      const keysOk = this.cloudMethod() === 'readonly_role' || (!!this.accessKeyId().trim() && !!this.secretAccessKey().trim());
      return this.accountIdValid() && this.regions().length > 0 && keysOk;
    }
    return !!this.platform() && this.credentialFields().every((f) => (this.secrets()[f.key] ?? '').trim().length > 0);
  });

  ngOnInit(): void {
    this.catalogs.options('connection_method').subscribe((o) => this.methodOptions.set(o));
    this.catalogs.options('aws_region').subscribe((o) => this.regionOptions.set(o));
  }

  // Solo dígitos: el número de cuenta no lleva guiones ni espacios (se pega tal cual de la consola de AWS).
  setAccountId(value: string): void {
    this.accountId.set(value.replace(/\D/g, '').slice(0, 12));
  }

  toggleRegion(value: string): void {
    this.regions.update((list) => (list.includes(value) ? list.filter((r) => r !== value) : [...list, value]));
  }

  choose(code: string): void {
    this.category.set(code);
    // Hoy se conecta AWS; Azure y Google Cloud llegan cuando el comité entregue sus cuentas de prueba.
    this.platform.set(code === CLOUD ? 'aws' : null);
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
    if (code === CLOUD) {
      this.save({
        name: this.name().trim(),
        connection_category: code,
        platform: 'aws',
        ip_address: null,
        location: null,
        criticality: this.criticality(),
        service_ids: [this.service().id, ...this.extraServiceIds()],
        connection_method: this.cloudMethod(),
        external_account_id: this.accountId().trim(),
        regions: this.regions(),
        // Las llaves solo viajan aquí, se guardan cifradas y no se vuelven a mostrar.
        ...(this.cloudMethod() === 'access_keys' ? { credentials: { access_key_id: this.accessKeyId().trim(), secret_access_key: this.secretAccessKey().trim() } } : {}),
      });
      return;
    }
    const credentials: Record<string, string> = {};
    for (const f of this.credentialFields()) credentials[f.key] = (this.secrets()[f.key] ?? '').trim();
    if (this.usesAgentChoice()) credentials['connection_method'] = this.method();

    this.save({
      name: this.name().trim(),
      connection_category: code,
      platform: this.platform()!,
      ip_address: this.ip().trim() || null,
      location: this.location().trim() || null,
      criticality: this.criticality(),
      service_ids: [this.service().id, ...this.extraServiceIds()],
      ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    });
  }

  private save(input: NewAssetInput): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.api.createAsset(input).subscribe({
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
    if (code === 'CONNECTION_METHOD_NOT_APPLICABLE') {
      this.error.set('Ese tipo de conexión no está disponible para este activo. Elige otro.');
      return;
    }
    this.error.set(apiErrorMessage(error, 'No pudimos registrar el activo. Inténtalo de nuevo.'));
  }
}
