import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlDetailManagement, ControlPerson, DecisionKind, ManagementAction, ManagementRequirement } from '@features/compliance/domain/models/control.models';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { can, personLabel } from '@features/compliance/domain/utils/control-approval';
import { Busy } from '@shared/presentation/directives/busy';
import { SessionService } from '@core/domain/services/session.service';
import { Card } from '@shared/presentation/components/card/card';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { StatusTone } from '@shared/domain/models/status-tone.model';
import { Tag } from '@shared/presentation/components/tag/tag';

const ACTIONS: ManagementAction[] = ['register_occurrence', 'declare_no_occurrences', 'request_not_applicable', 'revert_not_applicable', 'decide_not_applicable'];
const TONES: Record<string, StatusTone> = { applicable: 'neutral', not_applicable_pending: 'warn', not_applicable: 'info' };

// «Requisitos» (D135, DT-115): cada requisito con su estado de aplicabilidad, pedir «No aplica» o volver a medirlo, decidir la solicitud y, en los «cuando ocurra», registrar casos o
// declarar que no hubo. Los botones salen de `allowed_actions` de cada requisito.
@Component({
  selector: 'app-control-applicability-section',
  imports: [TranslatePipe, DetailSection, Card, StatusIndicator, Tag, Busy],
  templateUrl: './control-applicability-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlApplicabilitySection {
  protected readonly labels = inject(ManagementLabelsService);
  protected readonly can = can;
  protected readonly personLabel = personLabel;

  readonly management = input.required<ControlDetailManagement>();
  /** Quien tiene el control (el detalle); sin él no hay nombre que decir. */
  readonly owner = input<ControlPerson | null>(null);
  readonly busy = input(false);
  readonly acting = input<string | null>(null);
  readonly goEvidence = output<void>();
  readonly markNotApplicable = output<ManagementRequirement>();
  readonly revert = output<ManagementRequirement>();
  readonly decide = output<{ id: string; decision: DecisionKind }>();
  readonly registerOccurrence = output<ManagementRequirement>();
  readonly declare = output<ManagementRequirement>();

  protected readonly rows = computed(() => this.management().requirements);
  /** Lo que el usuario eligió en la lista; mientras no elija, manda la selección por defecto. */
  private readonly chosen = signal<string | null>(null);
  /** El requisito abierto: el elegido (si sigue en la lista), si no el primero con alguna acción y, si ninguno la tiene, el primero. */
  protected readonly selected = computed(() => {
    const rows = this.rows();
    return rows.find((r) => r.id === this.chosen()) ?? rows.find((r) => this.hasActions(r)) ?? rows[0] ?? null;
  });
  private readonly session = inject(SessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected tone(applicability: string): StatusTone {
    return TONES[applicability] ?? 'neutral';
  }

  /** ¿Tiene el usuario alguna acción en este requisito? Solo las que se muestran aquí. */
  protected hasActions(r: ManagementRequirement): boolean {
    return ACTIONS.some((a) => can(r.allowed_actions, a));
  }

  /**
   * Por qué quien mira no tiene acciones en este requisito (el servidor ya decidió que no): o espera la decisión del administrador de lo que pidió, o el control lo lleva otra persona.
   * Lleva el control el responsable dueño; sin responsable, el administrador (gestion.md). Sin ninguna de las dos razones, el texto general.
   */
  protected noActions(r: ManagementRequirement): { key: string; params: Record<string, string> } {
    const me = this.session.user();
    const owner = this.owner();
    const na = r.not_applicable;
    if (na && na.status === 'pending' && me && na.requested_by?.id === me.id) return { key: 'COMPLIANCE.APPROVAL.REQUIREMENTS.NO_ACTIONS_WAITING', params: {} };
    const manager = me?.role === 'admin_empresa' || me?.role === 'responsable';
    const leads = !!me && manager && (owner ? owner.id === me.id : me.role === 'admin_empresa');
    if (!leads) {
      const name = personLabel(owner);
      return owner && name !== '—'
        ? { key: 'COMPLIANCE.APPROVAL.REQUIREMENTS.NO_ACTIONS_OWNER_NAMED', params: { name } }
        : { key: 'COMPLIANCE.APPROVAL.REQUIREMENTS.NO_ACTIONS_OWNER', params: {} };
    }
    return { key: 'COMPLIANCE.APPROVAL.REQUIREMENTS.NO_ACTIONS', params: {} };
  }

  protected select(r: ManagementRequirement): void {
    this.chosen.set(r.id);
  }

  /** Flechas, Inicio y Fin mueven la selección y el foco (la lista es un `listbox`); Enter y Espacio eligen el requisito enfocado. */
  protected onKey(event: KeyboardEvent): void {
    const rows = this.rows();
    const current = Math.max(0, rows.findIndex((r) => r.id === this.selected()?.id));
    const next = { ArrowDown: current + 1, ArrowRight: current + 1, ArrowUp: current - 1, ArrowLeft: current - 1, Home: 0, End: rows.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = rows[Math.min(rows.length - 1, Math.max(0, next))];
    if (!target) return;
    this.select(target);
    this.host.nativeElement.querySelector<HTMLElement>(`[data-requirement="${CSS.escape(target.id)}"]`)?.focus();
  }
}
