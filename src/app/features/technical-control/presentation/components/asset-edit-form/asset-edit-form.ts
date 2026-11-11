import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Asset, UpdateAssetInput } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { targetValue } from '@shared/presentation/utils/event-target';

const ACCOUNT_ID = /^\d{12}$/;

// Edita un sistema ya registrado. Nombre y criticidad se cambian sin más; en una cuenta de nube también la cuenta, las regiones, el rol o las llaves.
// Lo que cambia la conexión la devuelve a «pendiente» (lo que ya se comprobó no vale para lo nuevo) y se le avisa al cliente antes de guardar.
@Component({
  selector: 'app-asset-edit-form',
  imports: [OptionChips, TranslatePipe],
  templateUrl: './asset-edit-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetEditForm implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly asset = input.required<Asset>();
  readonly criticalities = input<CatalogOption[]>([]);
  /** ¿Se puede lanzar una evaluación desde aquí? Solo una cuenta de nube ya conectada. */
  readonly canEvaluate = input(false);
  /** Hay una evaluación en cola o en curso: el botón espera. */
  readonly evaluating = input(false);
  readonly saved = output<Asset>();
  readonly cancelled = output<void>();
  /** Pide evaluar ahora; quien lo usa (la tarjeta del activo) hace la llamada. */
  readonly evaluate = output<void>();

  readonly name = signal('');
  readonly criticality = signal('');
  readonly accountId = signal('');
  readonly regions = signal<string[]>([]);
  readonly roleArn = signal('');
  readonly accessKeyId = signal('');
  readonly secretAccessKey = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  private readonly regionOptions = signal<CatalogOption[]>([]);

  readonly method = computed(() => this.asset().provisioning.connection_method ?? null);
  readonly isCloud = computed(() => this.asset().connection_category === 'ac_01' && !!this.method() && this.method() !== 'agent');
  readonly usesRole = computed(() => this.method() === 'readonly_role');
  readonly usesKeys = computed(() => this.method() === 'access_keys');
  readonly regionChips = computed<ChipOption[]>(() => this.regionOptions().map((r) => ({ value: r.value, label: r.label })));
  readonly criticalityChips = computed<ChipOption[]>(() => this.criticalities().map((c) => ({ value: c.value, label: c.label })));

  // Lo que se enviaría: solo lo que cambió. Vacío si no hay nada que guardar.
  readonly patch = computed<UpdateAssetInput>(() => {
    const a = this.asset();
    const p: UpdateAssetInput = {};
    if (this.name().trim() && this.name().trim() !== a.name) p.name = this.name().trim();
    if (this.criticality() && this.criticality() !== a.criticality) p.criticality = this.criticality();
    if (this.isCloud()) {
      if (this.accountId() && this.accountId() !== a.external_account_id) p.external_account_id = this.accountId();
      const current = a.provisioning.regions ?? [];
      if (!sameSet(this.regions(), current)) p.regions = this.regions();
      const role = this.roleArn().trim();
      if (this.usesRole() && role && role !== (a.connection_setup?.role_arn ?? '')) p.role_arn = role;
      if (this.usesKeys() && (this.accessKeyId().trim() || this.secretAccessKey().trim())) {
        p.credentials = { access_key_id: this.accessKeyId().trim(), secret_access_key: this.secretAccessKey().trim() };
      }
    }
    return p;
  });
  readonly changesConnection = computed(() => ['external_account_id', 'regions', 'role_arn', 'credentials'].some((k) => k in this.patch()));
  readonly dirty = computed(() => Object.keys(this.patch()).length > 0);
  readonly valid = computed(() => {
    if (!this.name().trim()) return false;
    if (!this.isCloud()) return true;
    if (!ACCOUNT_ID.test(this.accountId())) return false;
    if (this.regions().length === 0) return false;
    // Las llaves se cambian las dos juntas.
    return !this.usesKeys() || !!this.accessKeyId().trim() === !!this.secretAccessKey().trim();
  });

  ngOnInit(): void {
    const a = this.asset();
    this.name.set(a.name);
    this.criticality.set(a.criticality ?? '');
    this.accountId.set(a.external_account_id ?? '');
    this.regions.set([...(a.provisioning.regions ?? [])]);
    this.roleArn.set(a.connection_setup?.role_arn ?? '');
  }

  constructor() {
    // El backend traduce las regiones: al cambiar el idioma se vuelven a pedir, sin tocar lo que el cliente ya escribió.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.isCloud()) this.catalogs.options('aws_region').subscribe((o) => this.regionOptions.set(o));
      });
    });
  }

  setAccountId(value: string): void {
    this.accountId.set(value.replace(/\D/g, '').slice(0, 12));
  }

  toggleRegion(value: string): void {
    this.regions.update((list) => (list.includes(value) ? list.filter((r) => r !== value) : [...list, value]));
  }

  fieldError(field: string): string | null {
    return this.fieldErrors()[field] ?? null;
  }

  save(): void {
    if (!this.valid() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.api.updateAsset(this.asset().id, this.patch()).subscribe({
      next: (asset) => {
        this.saving.set(false);
        this.saved.emit(asset);
      },
      error: (error) => {
        this.saving.set(false);
        const fields = apiFieldErrors(error);
        if (fields.length) this.fieldErrors.set(Object.fromEntries(fields.map((f) => [f.field.replace(/^credentials\..*/, 'credentials'), f.message])));
        else this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.EDIT.SAVE_ERROR')));
      },
    });
  }
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
