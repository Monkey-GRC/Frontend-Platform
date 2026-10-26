import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Asset, Capability, ConnectionMethod, NewAssetInput, Platform } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';

const ACCOUNT_ID = /^\d{12}$/;

// Los datos de la plataforma que el cliente eligió en el marketplace (D67). Hoy solo AWS tiene flujo: las demás plataformas se muestran bloqueadas y
// no llegan aquí. Las llaves solo se piden aquí, se guardan cifradas y no se vuelven a mostrar.
@Component({
  selector: 'app-connect-asset-form',
  imports: [OptionChips, TranslatePipe],
  templateUrl: './connect-asset-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectAssetForm implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly capability = input.required<Capability>();
  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  // Otros servicios de la empresa a los que este sistema también podría dar soporte.
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);

  readonly created = output<Asset>();
  readonly cancelled = output<void>();

  readonly name = signal('');
  readonly criticality = signal('medium');
  readonly extraServiceIds = signal<string[]>([]);
  readonly showHints = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  // Canal, cuenta y regiones declaradas. Los canales salen de la plataforma (el primero es el recomendado) y las regiones del backend: la pantalla no las fija.
  readonly method = signal<ConnectionMethod | null>(null);
  readonly accountId = signal('');
  readonly regions = signal<string[]>([]);
  readonly accessKeyId = signal('');
  readonly secretAccessKey = signal('');
  private readonly methodOptions = signal<CatalogOption[]>([]);
  private readonly regionOptions = signal<CatalogOption[]>([]);
  readonly methods = computed(() => this.platform().connection_methods.map((value) => ({ value, label: this.methodOptions().find((m) => m.value === value)?.label ?? value })));
  readonly regionChips = computed<ChipOption[]>(() => this.regionOptions().map((r) => ({ value: r.value, label: r.label })));
  readonly accountIdValid = computed(() => ACCOUNT_ID.test(this.accountId().trim()));
  readonly criticalityChips = computed<ChipOption[]>(() => this.criticalities().map((c) => ({ value: c.value, label: c.label })));

  readonly valid = computed(() => {
    if (!this.name().trim() || !this.method()) return false;
    const keysOk = this.method() !== 'access_keys' || (!!this.accessKeyId().trim() && !!this.secretAccessKey().trim());
    return this.accountIdValid() && this.regions().length > 0 && keysOk;
  });

  ngOnInit(): void {
    // El primer canal es el recomendado.
    this.method.set(this.platform().connection_methods[0] ?? null);
  }

  constructor() {
    // El backend traduce las opciones: al cambiar el idioma se vuelven a pedir, sin tocar lo que el cliente ya escribió.
    effect(() => {
      this.language.current();
      untracked(() => this.loadCatalogs());
    });
  }

  private loadCatalogs(): void {
    this.catalogs.options('connection_method').subscribe((o) => this.methodOptions.set(o));
    // Las regiones de esa plataforma: `<código>_region`, de la base (D67).
    this.catalogs.options(`${this.platform().code}_region`).subscribe((o) => this.regionOptions.set(o));
  }

  // Solo dígitos: el número de cuenta no lleva guiones ni espacios (se pega tal cual de la consola de AWS).
  setAccountId(value: string): void {
    this.accountId.set(value.replace(/\D/g, '').slice(0, 12));
  }

  toggleRegion(value: string): void {
    this.regions.update((list) => (list.includes(value) ? list.filter((r) => r !== value) : [...list, value]));
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
    this.save({
      name: this.name().trim(),
      connection_category: this.capability().catalog_code,
      platform: this.platform().code,
      ip_address: null,
      location: null,
      criticality: this.criticality(),
      service_ids: [this.service().id, ...this.extraServiceIds()],
      connection_method: this.method()!,
      external_account_id: this.accountId().trim(),
      regions: this.regions(),
      // Las llaves solo viajan aquí, se guardan cifradas y no se vuelven a mostrar.
      ...(this.method() === 'access_keys' ? { credentials: { access_key_id: this.accessKeyId().trim(), secret_access_key: this.secretAccessKey().trim() } } : {}),
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
    const fields = apiFieldErrors(error);
    if (fields.length > 0) {
      this.fieldErrors.set(Object.fromEntries(fields.map((f) => [f.field.replace(/^credentials\./, ''), f.message])));
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.CHECK_MARKED'));
      return;
    }
    if (code === 'CONNECTION_METHOD_NOT_APPLICABLE') {
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.METHOD_NOT_APPLICABLE'));
      return;
    }
    this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.FORM.REGISTER_ERROR')));
  }
}
