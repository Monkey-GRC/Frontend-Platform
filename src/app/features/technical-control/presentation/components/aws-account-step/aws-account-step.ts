import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Field } from '@shared/presentation/components/field/field';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { targetValue } from '@shared/presentation/utils/event-target';
import { cleanAwsAccountId, isAwsAccountId } from '@features/technical-control/domain/utils/aws-validation';
import { ConnectionCommonFields } from '../connection-common-fields/connection-common-fields';

// Datos de la cuenta de AWS: número de cuenta, regiones (las únicas que Monkey evalúa), cómo se llamará la conexión y qué tan importante es. Aquí no hay claves ni contraseñas.
@Component({
  selector: 'app-aws-account-step',
  imports: [Field, OptionChips, ConnectionCommonFields, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCOUNT.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCOUNT.SUBTITLE' | translate }}</p>

    <div class="mt-8 space-y-6">
      <app-field labelKey="TECHNICAL_CONTROL.EDIT.ACCOUNT" forId="aws-account" hintKey="TECHNICAL_CONTROL.FORM.ACCOUNT_HELP" [errorKey]="accountError()">
        <input id="aws-account" class="mk-input font-mono" type="text" inputmode="numeric" maxlength="12" autocomplete="off" spellcheck="false" aria-describedby="aws-account-hint aws-account-error"
          [value]="accountId()" (input)="accountId.set(clean(targetValue($event)))" placeholder="123456789012" [attr.aria-invalid]="accountError() ? 'true' : null" />
      </app-field>
      @if (serverError('external_account_id'); as e) {
        <p class="-mt-4 text-xs text-bad-ink" role="alert" data-server-error>{{ e }}</p>
      }

      <div>
        <p id="aws-regions-label" class="mb-1.5 text-xs font-medium text-ink-faint">{{ 'TECHNICAL_CONTROL.FORM.REGIONS_LABEL' | translate }}</p>
        <p class="mb-3 text-xs text-ink-muted">{{ 'TECHNICAL_CONTROL.FORM.REGIONS_HELP' | translate }}</p>
        <app-option-chips [options]="regionChips()" [selected]="regions()" [multiple]="true" [ariaLabel]="'TECHNICAL_CONTROL.EDIT.REGIONS_ARIA' | translate" (picked)="toggleRegion($event)" />
        @if (serverError('regions') ?? regionsError(); as e) {
          <p class="mt-2 text-xs text-bad-ink" role="alert" data-regions-error>{{ e | translate }}</p>
        }
      </div>

      <app-connection-common-fields idPrefix="aws" namePlaceholderKey="TECHNICAL_CONTROL.WIZARD.AWS.ACCOUNT.NAME_PLACEHOLDER" [(name)]="name" [(criticality)]="criticality" [(extraServiceIds)]="extraServiceIds"
        [criticalities]="criticalities()" [otherServices]="otherServices()" [showHints]="showHints()" />
    </div>

    @if (error(); as e) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-error>{{ e }}</p>
    }
  `,
})
export class AwsAccountStep {
  protected readonly targetValue = targetValue;
  protected readonly clean = cleanAwsAccountId;

  readonly accountId = model('');
  readonly regions = model<string[]>([]);
  readonly name = model('');
  readonly criticality = model('medium');
  readonly extraServiceIds = model<string[]>([]);

  readonly regionOptions = input<CatalogOption[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly showHints = input(false);
  readonly fieldErrors = input<Record<string, string>>({});
  readonly error = input<string | null>(null);

  readonly regionChips = computed<ChipOption[]>(() => this.regionOptions().map((r) => ({ value: r.value, label: r.label })));
  readonly accountError = computed(() => (this.showHints() && !isAwsAccountId(this.accountId()) ? 'TECHNICAL_CONTROL.FORM.ACCOUNT_HINT' : null));
  readonly regionsError = computed(() => (this.showHints() && this.regions().length === 0 ? 'TECHNICAL_CONTROL.FORM.REGIONS_HINT' : null));

  toggleRegion(value: string): void {
    this.regions.update((list) => (list.includes(value) ? list.filter((r) => r !== value) : [...list, value]));
  }

  serverError(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }
}
