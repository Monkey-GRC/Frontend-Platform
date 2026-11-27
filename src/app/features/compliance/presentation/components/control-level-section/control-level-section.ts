import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDetailManagement, DecisionKind } from '@features/compliance/domain/models/control.models';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { can, personLabel } from '@features/compliance/domain/utils/control-approval';
import { levelTone } from '@features/compliance/domain/utils/control-v2-look';
import { Busy } from '@shared/presentation/directives/busy';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { Card } from '@shared/presentation/components/card/card';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';

// «Nivel» (R5, D140): el nivel final con el sugerido si hubo corrección aprobada, la propuesta que espera al administrador y los botones que el servidor dejó (`allowed_actions`).
@Component({
  selector: 'app-control-level-section',
  imports: [TranslatePipe, Card, StatusIndicator, Busy, ExpandableText],
  templateUrl: './control-level-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
})
export class ControlLevelSection {
  protected readonly labels = inject(ManagementLabelsService);
  protected readonly levelTone = levelTone;
  protected readonly personLabel = personLabel;

  readonly management = input.required<ControlDetailManagement>();
  readonly busy = input(false);
  /** El acto en curso de un botón de esta sección (`nivel:id`): ese botón muestra el spinner. */
  readonly acting = input<string | null>(null);
  readonly propose = output<void>();
  readonly decide = output<{ id: string; decision: DecisionKind }>();

  protected readonly level = computed(() => this.management().level);
  protected readonly pending = computed(() => {
    const o = this.management().level_override;
    return o && o.status === 'pending' ? o : null;
  });
  protected readonly rejected = computed(() => {
    const o = this.management().level_override;
    return o && o.status === 'rejected' ? o : null;
  });
  protected readonly canPropose = computed(() => can(this.management().allowed_actions, 'propose_level'));
  protected readonly canDecide = computed(() => can(this.management().allowed_actions, 'decide_level') && this.pending() !== null);
  /** «{final} · sugerido: {sugerido}» solo si hay una corrección aprobada. */
  protected readonly corrected = computed(() => this.level()?.is_corrected ?? false);
}
