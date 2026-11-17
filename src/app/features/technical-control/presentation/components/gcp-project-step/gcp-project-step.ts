import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Field } from '@shared/presentation/components/field/field';
import { targetValue } from '@shared/presentation/utils/event-target';
import { isGcpProjectId } from '@features/technical-control/domain/utils/gcp-validation';
import { ConnectionCommonFields } from '../connection-common-fields/connection-common-fields';

// Datos del proyecto de Google Cloud: lo único que se pide es el ID del proyecto, cómo se llamará la conexión y qué tan importante es. Aquí no hay claves ni contraseñas:
// el acceso se da en el paso siguiente, desde la cuenta del cliente.
@Component({
  selector: 'app-gcp-project-step',
  imports: [Field, ConnectionCommonFields, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.SUBTITLE' | translate }}</p>

    <div class="mt-8 space-y-6">
      <app-field labelKey="TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.ID_LABEL" forId="gcp-project-id" hintKey="TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.ID_HELP" [errorKey]="projectIdError()">
        <input id="gcp-project-id" class="mk-input font-mono" type="text" autocomplete="off" spellcheck="false" maxlength="30" aria-describedby="gcp-project-id-hint gcp-project-id-error"
          [value]="projectId()" (input)="projectId.set(targetValue($event).trim())" placeholder="acme-production-42190" [attr.aria-invalid]="projectIdError() ? 'true' : null" />
      </app-field>
      @if (serverError('external_account_id'); as e) {
        <p class="-mt-4 text-xs text-bad-ink" role="alert" data-server-error>{{ e }}</p>
      }

      <app-connection-common-fields idPrefix="gcp" namePlaceholderKey="TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.NAME_PLACEHOLDER" [(name)]="name" [(criticality)]="criticality" [(extraServiceIds)]="extraServiceIds"
        [criticalities]="criticalities()" [otherServices]="otherServices()" [showHints]="showHints()" />
    </div>

    @if (error(); as e) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-error>{{ e }}</p>
    }
  `,
})
export class GcpProjectStep {
  protected readonly targetValue = targetValue;

  readonly projectId = model('');
  readonly name = model('');
  readonly criticality = model('medium');
  readonly extraServiceIds = model<string[]>([]);

  readonly criticalities = input<CatalogOption[]>([]);
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  // Se muestran los avisos de lo que falta o está mal escrito solo después de intentar seguir.
  readonly showHints = input(false);
  readonly fieldErrors = input<Record<string, string>>({});
  readonly error = input<string | null>(null);

  readonly projectIdError = computed(() => (this.showHints() && !isGcpProjectId(this.projectId()) ? 'TECHNICAL_CONTROL.WIZARD.GCP.PROJECT.ID_INVALID' : null));

  serverError(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }
}
