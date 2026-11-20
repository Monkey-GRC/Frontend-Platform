import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { SideDrawer } from '@shared/presentation/components/side-drawer/side-drawer';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import type { UserRole } from '@core/domain/models/auth.models';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { controlStateTone } from '@features/compliance/domain/utils/control-state-look';
import { ControlDetail, ControlDimension, UpdateControlBody } from '@features/compliance/domain/models/control.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ControlEvidence } from '../control-evidence/control-evidence';
import { DetailCard } from '../detail-card/detail-card';
import { ControlTests } from '../control-tests/control-tests';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { hasChanges } from '@shared/domain/utils/form-changes';

type Stage = 'loading' | 'error' | 'ready';

/** Las cinco dimensiones, siempre en este orden: la fila de dimensiones muestra todas, con ✓ las que aplican y ✗ las que no. */
const DIMENSION_ORDER: ControlDimension[] = ['policy', 'server', 'database', 'app', 'cloud'];
type Mode = 'view' | 'interpretation' | 'dimensions';

interface DimensionDraft {
  dimension: ControlDimension;
  applies: boolean;
  reason: string;
}

// Quién edita un control (compliance-controls.md → «Quién puede qué», D96): solo el administrador de la empresa, al instante. El responsable, el delegado y el auditor leen.
// El backend lo vuelve a comprobar.
const EDITING_ROLES: readonly UserRole[] = ['admin_empresa'];
const INTERPRETATION_MAX = 4000;
// Suben la evidencia el administrador de la empresa, el responsable (dueño) y el delegado (ejecutor), cada uno de lo suyo (D102); el auditor solo lee.
const UPLOADING_ROLES: readonly UserRole[] = ['admin_empresa', 'responsable', 'delegado'];

// El detalle de un control (MD-121), en un panel lateral. El administrador edita al instante y puede dar de baja (D96): el cambio se aplica y el avance se
// recalcula. Los errores 422 se muestran bajo cada campo. El dueño y el ejecutor del control (D102) llegan con MD-202, cuando el Backend los exponga.
@Component({
  selector: 'app-control-detail-panel',
  imports: [Badge, FormsModule, TranslatePipe, SideDrawer, StatusIndicator, Tag, ConfirmDialog, ControlEvidence, ControlTests, DetailCard, Skeleton, SkeletonRegion, Busy, BusyFields],
  templateUrl: './control-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlDetailPanel {
  protected readonly readinessLook = readinessLook;
  protected readonly controlStateTone = controlStateTone;
  protected readonly labels = inject(EnumLabelService);
  private readonly api = inject(ControlService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  readonly view = inject(ComplianceViewService);

  readonly controlId = input.required<string>();
  readonly closed = output<void>();
  // El control cambió (se editó o se dio de baja): la lista se vuelve a pedir.
  readonly changed = output<void>();

  readonly maxInterpretation = INTERPRETATION_MAX;

  private readonly language = inject(LanguageService);
  readonly percentOf = percentOf;

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  readonly stage = signal<Stage>('loading');
  readonly detail = signal<ControlDetail | null>(null);

  readonly mode = signal<Mode>('view');
  readonly saving = signal(false);
  readonly confirmingRetire = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly interpretationDraft = signal('');
  readonly dimensionsDraft = signal<DimensionDraft[]>([]);

  /** MD-485 · La interpretación o las dimensiones a medio editar, distintas de lo guardado: cerrar el panel pide confirmar antes de descartarlas. */
  readonly editing = computed(() => {
    const d = this.detail();
    if (!d) return false;
    if (this.mode() === 'interpretation') return hasChanges(d.interpretation.text, this.interpretationDraft());
    if (this.mode() === 'dimensions') {
      const saved = d.dimensions.map((x) => ({ dimension: x.dimension, applies: x.applies, reason: x.reason_not_applicable ?? '' }));
      return hasChanges(saved, this.dimensionsDraft());
    }
    return false;
  });

  /** Las cinco dimensiones del control. Una que el detalle no trae no aplica (no hay prueba de esa dimensión). */
  protected readonly dimensionRow = computed(() => {
    const byDimension = new Map((this.detail()?.dimensions ?? []).map((x) => [x.dimension, x]));
    return DIMENSION_ORDER.map((dimension) => ({
      dimension,
      applies: byDimension.get(dimension)?.applies ?? false,
      reason: byDimension.get(dimension)?.reason_not_applicable ?? null,
    }));
  });

  readonly canEdit = computed(() => {
    const role = this.view.role();
    return role !== null && EDITING_ROLES.some((r) => r === role);
  });

  /** ¿La subida de evidencia va bajo las pruebas manuales? Solo si el detalle trae las pruebas y alguna es manual; si no, va aparte. */
  protected evidenceUnderTests(d: ControlDetail): boolean {
    const dims = new Map(d.dimensions.map((x) => [x.dimension, x.type]));
    return !!d.technical?.tests?.some((t) => dims.get(t.dimension) === 'manual');
  }

  readonly canUploadEvidence = computed(() => {
    const role = this.view.role();
    return role !== null && UPLOADING_ROLES.some((r) => r === role);
  });


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
      },
      error: () => this.stage.set('error'),
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
    this.save({ interpretation: { text: this.interpretationDraft().trim() } });
  }

  submitDimensions(): void {
    if (!this.dimensionsValid()) return;
    this.save({
      dimensions: this.dimensionsDraft().map((d) => ({
        dimension: d.dimension,
        applies: d.applies,
        ...(d.applies ? {} : { reason_not_applicable: d.reason.trim() }),
      })),
    });
  }

  askRetire(): void {
    this.resetFeedback();
    this.confirmingRetire.set(true);
  }

  confirmRetire(): void {
    this.saving.set(true);
    this.resetFeedback();
    this.api.retire(this.controlId()).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmingRetire.set(false);
        // El control ya no existe para las listas: se avisa y se cierra el panel.
        this.changed.emit();
        this.closed.emit();
      },
      error: (error) => this.failed(error),
    });
  }

  fieldError(path: string): string | null {
    return this.fieldErrors()[path] ?? null;
  }

  private save(body: UpdateControlBody): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.resetFeedback();
    this.api.update(this.controlId(), body, this.view.viewParam()).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.detail.set(detail);
        this.mode.set('view');
        this.toast.showSuccess(this.translate.instant('COMPLIANCE.DETAIL.SAVED'));
        this.changed.emit();
      },
      error: (error) => this.failed(error),
    });
  }

  private failed(error: unknown): void {
    this.saving.set(false);
    this.confirmingRetire.set(false);
    this.fieldErrors.set(Object.fromEntries(apiFieldErrors(error).map((f) => [f.field, f.message])));
    // `message` ya viene traducido por el backend (también en 409: el control ya estaba dado de baja).
    this.error.set(apiErrorMessage(error, this.translate.instant('COMPLIANCE.DETAIL.SAVE_ERROR')));
  }
  private resetFeedback(): void {
    this.error.set(null);
    this.fieldErrors.set({});
  }
}
