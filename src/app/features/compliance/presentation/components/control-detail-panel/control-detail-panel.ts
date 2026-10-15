import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { SidePanel } from '@shared/presentation/components/side-panel/side-panel';
import { StatusBadge } from '@shared/presentation/components/status-badge/status-badge';
import {
  ControlChange,
  ControlChangeType,
  ControlDetail,
  ControlDimension,
  ProposeChangeBody,
  controlCode,
  requirementCodes,
} from '../../../domain/models/control.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { ControlService } from '../../../domain/services/control.service';

type Stage = 'loading' | 'error' | 'ready';
type Mode = 'view' | 'interpretation' | 'dimensions';

interface DimensionDraft {
  dimension: ControlDimension;
  applies: boolean;
  reason: string;
}

// Quién puede proponer cambios (compliance-controls.md → «Quién puede qué»): el administrador de la empresa y el funcional (solo lo asignado, que es
// lo único que le llega). El consultor y el auditor solo leen. El backend lo vuelve a comprobar.
const PROPOSING_ROLES: readonly string[] = ['admin_empresa', 'funcional'];
const INTERPRETATION_MAX = 4000;

// El detalle de una acción de protección (MD-121), en un panel lateral. Editar es PROPONER: la acción sigue como estaba y sigue contando hasta
// que el consultor apruebe el cambio (D65). Los errores 422 se muestran bajo cada campo.
@Component({
  selector: 'app-control-detail-panel',
  imports: [FormsModule, TranslatePipe, SidePanel, StatusBadge, ConfirmDialog],
  templateUrl: './control-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlDetailPanel {
  private readonly api = inject(ControlService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);

  readonly controlId = input.required<string>();
  readonly closed = output<void>();
  // La acción cambió (hay una propuesta nueva): la lista se vuelve a pedir.
  readonly changed = output<void>();

  readonly maxInterpretation = INTERPRETATION_MAX;

  private readonly language = inject(LanguageService);
  readonly codeOf = controlCode;
  readonly requirementsOf = requirementCodes;
  readonly percentOf = percentOf;

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  readonly stage = signal<Stage>('loading');
  readonly detail = signal<ControlDetail | null>(null);
  readonly pending = signal<ControlChange[]>([]);

  readonly mode = signal<Mode>('view');
  readonly saving = signal(false);
  readonly confirmingRetire = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly interpretationDraft = signal('');
  readonly dimensionsDraft = signal<DimensionDraft[]>([]);

  readonly canPropose = computed(() => {
    const role = this.view.role();
    return role !== null && PROPOSING_ROLES.includes(role);
  });

  private readonly pendingTypes = computed(() => new Set<ControlChangeType>(this.pending().map((c) => c.change_type)));
  readonly hasPending = (type: ControlChangeType): boolean => this.pendingTypes().has(type);

  constructor() {
    effect(() => {
      this.controlId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    this.api.get(this.controlId(), this.view.viewParam()).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.stage.set('ready');
        this.loadPending();
      },
      error: () => this.stage.set('error'),
    });
  }

  private loadPending(): void {
    // Qué propuestas esperan al consultor: se muestran y bloquean volver a proponer lo mismo (el backend responde 409 si se repite).
    this.api.changes(this.controlId(), 'pending').subscribe({
      next: (changes) => this.pending.set(changes),
      error: () => this.pending.set([]),
    });
  }

  startInterpretation(): void {
    this.resetFeedback();
    this.interpretationDraft.set(this.detail()?.interpretation.text ?? '');
    this.mode.set('interpretation');
  }

  startDimensions(): void {
    this.resetFeedback();
    this.dimensionsDraft.set(
      (this.detail()?.dimensions ?? []).map((d) => ({ dimension: d.dimension, applies: d.applies, reason: d.reason_not_applicable ?? '' })),
    );
    this.mode.set('dimensions');
  }

  cancelEdit(): void {
    this.resetFeedback();
    this.mode.set('view');
  }

  toggleDimension(index: number, applies: boolean): void {
    this.dimensionsDraft.update((list) => list.map((d, i) => (i === index ? { ...d, applies } : d)));
  }

  setReason(index: number, reason: string): void {
    this.dimensionsDraft.update((list) => list.map((d, i) => (i === index ? { ...d, reason } : d)));
  }

  /** ¿Se puede enviar? Una dimensión que no aplica exige su motivo (el backend lo vuelve a exigir). */
  readonly dimensionsValid = computed(() => this.dimensionsDraft().every((d) => d.applies || d.reason.trim().length > 0));
  readonly interpretationValid = computed(() => {
    const text = this.interpretationDraft().trim();
    return text.length > 0 && text.length <= INTERPRETATION_MAX;
  });

  submitInterpretation(): void {
    if (!this.interpretationValid()) return;
    this.propose({ change_type: 'edit_interpretation', proposed_values: { interpretation: this.interpretationDraft().trim() } });
  }

  submitDimensions(): void {
    if (!this.dimensionsValid()) return;
    this.propose({
      change_type: 'edit_dimensions',
      proposed_values: {
        dimensions: this.dimensionsDraft().map((d) => ({
          dimension: d.dimension,
          applies: d.applies,
          ...(d.applies ? {} : { reason_not_applicable: d.reason.trim() }),
        })),
      },
    });
  }

  askRetire(): void {
    this.resetFeedback();
    this.confirmingRetire.set(true);
  }

  confirmRetire(): void {
    this.propose({ change_type: 'retire', proposed_values: {} });
  }

  fieldError(path: string): string | null {
    return this.fieldErrors()[path] ?? null;
  }

  private propose(body: ProposeChangeBody): void {
    this.saving.set(true);
    this.resetFeedback();
    this.api.proposeChange(this.controlId(), body).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmingRetire.set(false);
        this.mode.set('view');
        this.notice.set(this.translate.instant('COMPLIANCE.DETAIL.PROPOSED'));
        this.loadPending();
        this.changed.emit();
      },
      error: (error) => {
        this.saving.set(false);
        this.confirmingRetire.set(false);
        this.fieldErrors.set(Object.fromEntries(apiFieldErrors(error).map((f) => [f.field, f.message])));
        // `message` ya viene traducido por el backend (también en 409: propuesta repetida o acción ya dada de baja).
        this.error.set(apiErrorMessage(error, this.translate.instant('COMPLIANCE.DETAIL.SAVE_ERROR')));
      },
    });
  }

  private resetFeedback(): void {
    this.notice.set(null);
    this.error.set(null);
    this.fieldErrors.set({});
  }
}
