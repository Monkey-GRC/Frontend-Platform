import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Field } from '@shared/presentation/components/field/field';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { targetValue } from '@shared/presentation/utils/event-target';

// Los datos que toda conexión pide en su paso «Datos», sea de la plataforma que sea: cómo se llamará, qué tan importante es y si da soporte a otros servicios. Los ids de los campos
// llevan el prefijo de la plataforma (`gcp-name`, `aws-name`).
@Component({
  selector: 'app-connection-common-fields',
  imports: [Field, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-6' },
  template: `
    <app-field labelKey="TECHNICAL_CONTROL.WIZARD.COMMON.NAME_LABEL" [forId]="idPrefix() + '-name'" hintKey="TECHNICAL_CONTROL.WIZARD.COMMON.NAME_HELP" [errorKey]="nameError()">
      <input [id]="idPrefix() + '-name'" class="mk-input" type="text" autocomplete="off" maxlength="200" [value]="name()" (input)="name.set(targetValue($event))"
        [placeholder]="namePlaceholderKey() | translate" [attr.aria-invalid]="nameError() ? 'true' : null" />
    </app-field>

    <app-field labelKey="TECHNICAL_CONTROL.FORM.IMPORTANCE" [forId]="idPrefix() + '-criticality'">
      <app-select [inputId]="idPrefix() + '-criticality'" [options]="criticalityOptions()" [value]="criticality()" (valueChange)="criticality.set($event)" ariaLabelKey="TECHNICAL_CONTROL.FORM.IMPORTANCE_ARIA" />
    </app-field>

    @if (serviceOptions().length > 0) {
      <app-field labelKey="TECHNICAL_CONTROL.FORM.ALSO_SUPPORTS" [forId]="idPrefix() + '-services'" hintKey="TECHNICAL_CONTROL.FORM.ALSO_SUPPORTS_HELP">
        <app-select [inputId]="idPrefix() + '-services'" multiple [options]="serviceOptions()" [values]="extraServiceIds()" (valuesChange)="extraServiceIds.set($event)"
          placeholderKey="TECHNICAL_CONTROL.WIZARD.COMMON.SERVICES_PLACEHOLDER" ariaLabelKey="TECHNICAL_CONTROL.FORM.ALSO_SUPPORTS" />
      </app-field>
    }
  `,
})
export class ConnectionCommonFields {
  protected readonly targetValue = targetValue;

  readonly name = model('');
  readonly criticality = model('medium');
  readonly extraServiceIds = model<string[]>([]);

  readonly idPrefix = input.required<string>();
  readonly namePlaceholderKey = input.required<string>();
  readonly criticalities = input<CatalogOption[]>([]);
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  // Los avisos de lo que falta salen solo después de intentar seguir.
  readonly showHints = input(false);

  readonly criticalityOptions = computed<SelectOption[]>(() => this.criticalities().map((c) => ({ value: c.value, label: c.label })));
  readonly serviceOptions = computed<SelectOption[]>(() => this.otherServices().map((s) => ({ value: s.id, label: s.name })));
  readonly nameError = computed(() => (this.showHints() && !this.name().trim() ? 'TECHNICAL_CONTROL.FORM.NAME_HINT' : null));
}
