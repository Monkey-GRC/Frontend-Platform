import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogName, CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Asset, NewAssetInput, Platform } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { targetValue } from '@shared/presentation/utils/event-target';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';

// Declarar un servidor (D112): el cliente dice cómo se llama, qué sistema y qué versión tiene, y qué tan importante es. De la versión sale el comando de
// instalación correcto, por eso es obligatoria. Aquí no se pide ninguna llave ni contraseña: la clave del servidor la entrega Monkey en el paso siguiente.
// Las versiones salen del backend (`<sistema>_version`): la pantalla no tiene ninguna escrita.
@Component({
  selector: 'app-connect-server-form',
  imports: [OptionChips, Select, TranslatePipe, ConfirmDialog],
  templateUrl: './connect-server-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectServerForm {
  protected readonly targetValue = targetValue;
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  // El código de la categoría de conexión (p. ej. `ac_04`, servidores on-premise): lo trae la ruta del asistente.
  readonly catalogCode = input.required<string>();
  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);

  readonly created = output<Asset>();
  readonly cancelled = output<void>();

  readonly name = signal('');
  readonly criticality = signal('medium');
  readonly osVersion = signal('');
  readonly extraServiceIds = signal<string[]>([]);
  readonly showHints = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly versions = signal<CatalogOption[]>([]);
  readonly versionsState = signal<'loading' | 'ready' | 'error'>('loading');
  // El selector de Monkey no agrupa: cada versión ya trae su nombre completo («Ubuntu 22.04 LTS») y el backend las entrega ordenadas por distribución.
  readonly versionOptions = computed<SelectOption[]>(() => this.versions().map((v) => ({ value: v.value, label: v.label })));
  readonly criticalityChips = computed<ChipOption[]>(() => this.criticalities().map((c) => ({ value: c.value, label: c.label })));
  readonly valid = computed(() => !!this.name().trim() && !!this.osVersion());
  /** Algo escrito o elegido distinto de lo de partida (criticidad media, sin versión ni servicios extra). */
  readonly dirty = computed(() => !!this.name().trim() || this.criticality() !== 'medium' || !!this.osVersion() || this.extraServiceIds().length > 0);

  /** MD-485 · Cancelar: con cambios sin guardar, primero se pide confirmar que se descartan. */
  readonly confirmingDiscard = signal(false);
  askCancel(): void {
    if (this.saving()) return;
    if (this.dirty()) this.confirmingDiscard.set(true);
    else this.cancelled.emit();
  }

  constructor() {
    // El backend traduce las versiones: al cambiar el idioma se vuelven a pedir, sin tocar lo que el cliente ya escribió ni la versión que eligió.
    effect(() => {
      this.language.current();
      const name = `${this.platform().code}_version` as CatalogName;
      untracked(() => this.loadVersions(name));
    });
  }

  private loadVersions(name: CatalogName): void {
    this.catalogs.options(name).subscribe({
      next: (options) => {
        this.versions.set(options);
        this.versionsState.set('ready');
      },
      error: () => this.versionsState.set('error'),
    });
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
      connection_category: this.catalogCode(),
      platform: this.platform().code,
      ip_address: null,
      location: null,
      criticality: this.criticality(),
      service_ids: [this.service().id, ...this.extraServiceIds()],
      connection_method: 'agent',
      os_version: this.osVersion(),
    });
  }

  private save(input: NewAssetInput): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.api.createAsset(input).subscribe({
      next: (asset) => {
        this.saving.set(false);
        this.toast.showSuccess(this.translate.instant('TECHNICAL_CONTROL.SERVER_FORM.CREATED', { name: asset.name ?? '' }));
        this.created.emit(asset);
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  private showError(error: unknown): void {
    const fields = apiFieldErrors(error);
    if (fields.length > 0) {
      this.fieldErrors.set(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.CHECK_MARKED'));
      return;
    }
    if (apiErrorCode(error) === 'CONNECTION_METHOD_NOT_APPLICABLE') {
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.METHOD_NOT_APPLICABLE'));
      return;
    }
    this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.SERVER_FORM.REGISTER_ERROR')));
  }
}
