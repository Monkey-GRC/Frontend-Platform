import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { apiFieldErrors } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { TabItem } from '@shared/presentation/components/tabs/tabs';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import type { UserRole } from '@core/domain/models/auth.models';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { CatalogService } from '@shared/domain/services/catalog.service';
import type { CatalogOption } from '@shared/domain/models/catalog.models';
import { ControlScore } from '../control-score/control-score';
import { ControlDetail, ControlDimension, UpdateControlBody } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ControlEvidence } from '../control-evidence/control-evidence';
import { DetailCard } from '../detail-card/detail-card';
import { DetailPanelBase } from '../detail-panel-base/detail-panel-base';
import { ControlTests } from '../control-tests/control-tests';
import { ControlRequirements } from '../control-requirements/control-requirements';
import { ControlPeriodicityForm } from '../control-periodicity-form/control-periodicity-form';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { periodicityText, summarizePeriodicity } from '@features/compliance/domain/utils/control-v2-look';
import { ControlPeriodView } from '../control-period/control-period';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { hasChanges } from '@shared/domain/utils/form-changes';

type Mode = 'view' | 'interpretation' | 'dimensions';

/** Las pestañas del detalle (MD-499). `requirements` y `period` solo en la vista técnica; `period`, además, solo si el período auditado está definido. */
type DetailTab = 'summary' | 'requirements' | 'evidence' | 'period';

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

// El detalle de un control (MD-121), en el modal de detalle ancho con pestañas (MD-499; la pestaña abierta va en `?tab=`, la pone la lista). El administrador edita al instante y puede dar de baja (D96): el cambio se aplica y el avance se
// recalcula. Los errores 422 se muestran bajo cada campo. El dueño y el ejecutor del control (D102) llegan con MD-202, cuando el Backend los exponga.
@Component({
  selector: 'app-control-detail-panel',
  imports: [Badge, ControlScore, FormsModule, TranslatePipe, DetailModal, DataTable, TableCell, SearchField, StatusIndicator, Tag, ConfirmDialog, ControlEvidence, ControlTests, ControlRequirements, ControlPeriodView, ControlPeriodicityForm, DetailCard, Skeleton, SkeletonRegion, Busy, BusyFields],
  templateUrl: './control-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlDetailPanel extends DetailPanelBase<ControlDetail, DetailTab> {
  protected readonly readinessLook = readinessLook;
  private readonly api = inject(ControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);
  protected readonly tabIds = ['summary', 'requirements', 'evidence', 'period'] as const;
  protected readonly saveErrorKey = 'COMPLIANCE.DETAIL.SAVE_ERROR';

  readonly controlId = input.required<string>();
  /** Una fila de la lista de causas: la vista abre esa causa en Causas. */
  readonly openCause = output<string>();

  readonly maxInterpretation = INTERPRETATION_MAX;
  /** Las nueve celdas de dimensiones del esqueleto de carga. */
  protected readonly nineCells = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  readonly mode = signal<Mode>('view');
  readonly fieldErrors = signal<Record<string, string>>({});

  /** Las pestañas que aplican a este control y a este rol: en la vista de negocio, solo Resumen y Evidencias (sin niveles ni requisitos). */
  readonly tabs = computed<TabItem[]>(() => {
    const d = this.ready();
    if (!d) return [];
    const items: TabItem[] = [{ id: 'summary', labelKey: 'COMPLIANCE.DETAIL_TABS.SUMMARY' }];
    if (d.technical) items.push({ id: 'requirements', labelKey: 'COMPLIANCE.DETAIL_TABS.REQUIREMENTS', count: d.technical.requirements?.length ?? null });
    items.push({ id: 'evidence', labelKey: 'COMPLIANCE.DETAIL_TABS.EVIDENCE' });
    if (d.technical?.period) items.push({ id: 'period', labelKey: 'COMPLIANCE.DETAIL_TABS.PERIOD' });
    return items;
  });

  readonly interpretationDraft = signal('');
  readonly dimensionsDraft = signal<DimensionDraft[]>([]);

  /** MD-485 · La interpretación o las dimensiones a medio editar, distintas de lo guardado: cerrar el panel pide confirmar antes de descartarlas. */
  readonly editing = computed(() => {
    const d = this.detail();
    if (!d) return false;
    if (this.mode() === 'interpretation') return hasChanges(d.interpretation.text, this.interpretationDraft());
    if (this.mode() === 'dimensions') {
      const saved = this.dimensionRow().map((x) => ({ dimension: x.dimension, applies: x.applies, reason: x.reason ?? '' }));
      return hasChanges(saved, this.dimensionsDraft());
    }
    return false;
  });

  /** Las dimensiones con su orden y etiqueta, como las sirve el catálogo `dimension`. */
  private readonly dimensionOptions = signal<CatalogOption[]>([]);

  /** El texto de una dimensión: la etiqueta del catálogo; si aún no llegó, la de las traducciones de la app. */
  protected dimLabel(dimension: string): string {
    return this.dimensionOptions().find((o) => o.value === dimension)?.label ?? this.labels.of('COMPLIANCE.DIMENSION', dimension);
  }

  /** Todas las dimensiones del catálogo, con ✓ las que aplican y ✗ las que no. Una que el detalle no trae no aplica (no hay prueba de esa dimensión). */
  protected readonly dimensionRow = computed(() => {
    const byDimension = new Map((this.detail()?.dimensions ?? []).map((x) => [x.dimension, x]));
    const order = this.dimensionOptions().length ? this.dimensionOptions().map((o) => o.value) : [...byDimension.keys()];
    return (order as ControlDimension[]).map((dimension) => ({
      dimension,
      applies: byDimension.get(dimension)?.applies ?? false,
      reason: byDimension.get(dimension)?.reason_not_applicable ?? null,
    }));
  });

  readonly canEdit = computed(() => {
    const role = this.view.role();
    return role !== null && EDITING_ROLES.some((r) => r === role);
  });

  /** Cambiar la periodicidad (G-10, D147): solo el administrador, y solo en un control del catálogo con requisitos (uno propio no los tiene). */
  readonly canChangePeriodicity = computed(() => {
    const d = this.ready();
    return this.canEdit() && !!d && d.origin === 'catalog' && (d.technical?.requirements?.length ?? 0) > 0;
  });
  readonly periodicityOpen = signal(false);
  protected readonly periodicity = computed(() => periodicityText(summarizePeriodicity(this.ready()?.technical?.requirements ?? []), this.labels));

  onPeriodicitySaved(detail: ControlDetail): void {
    this.detail.set(detail);
    this.periodicityOpen.set(false);
    this.toast.showSuccess(this.translate.instant('COMPLIANCE.PERIODICITY_CHANGE.SAVED'));
    this.changed.emit();
  }

  /** Una marca de tiempo del backend, como fecha en el idioma de la sesión. */
  protected day(iso: string): string {
    return formatLocalDate(iso, this.language.current()) || iso;
  }

  /** ¿La subida de evidencia va bajo las pruebas manuales? Solo si el detalle trae las pruebas y alguna es manual; si no, va aparte. */
  protected evidenceUnderTests(d: ControlDetail): boolean {
    return !!d.technical?.tests?.some((t) => t.accepts_evidence) || (d.evidence_tests?.length ?? 0) > 0;
  }

  readonly canUploadEvidence = computed(() => {
    const role = this.view.role();
    return role !== null && UPLOADING_ROLES.some((r) => r === role);
  });


  // Las causas del control: lista con buscador y paginación; cada fila abre esa causa en Causas.
  protected readonly causeColumns: TableColumn<{ id: string; code: string; name: string | null }>[] = [
    { key: 'code', headerKey: 'COMPLIANCE.RISKS.COL_CODE', class: 'w-28', skeleton: 'badge' },
    { key: 'name', headerKey: 'COMPLIANCE.RISKS.COL_NAME', skeleton: 'lines' },
  ];
  protected readonly causeKey = (c: { id: string }) => c.id;
  protected readonly causeLabel = (c: { code: string; name: string | null }) => [c.code, c.name].filter(Boolean).join(' ');
  readonly causeList = new ClientList(
    computed(() => this.ready()?.causes ?? []),
    (c, q) => includesText(q, c.code, c.name),
  );

  constructor() {
    super();
    this.catalogs.options('dimension').pipe(takeUntilDestroyed()).subscribe((options) => this.dimensionOptions.set(options));
  }

  protected override onRequest(): void {
    super.onRequest();
    this.mode.set('view');
    this.interpretationDraft.set('');
    this.dimensionsDraft.set([]);
    this.periodicityOpen.set(false);
    this.causeList.reset();
  }

  protected request() {
    return this.api.get(this.controlId(), this.view.viewParam());
  }

  protected remove() {
    return this.api.retire(this.controlId());
  }

  startInterpretation(): void {
    this.resetFeedback();
    this.interpretationDraft.set(this.detail()?.interpretation.text ?? '');
    this.mode.set('interpretation');
  }

  startDimensions(): void {
    this.resetFeedback();
    // Las 9 del catálogo: las que el detalle no trae (no tienen fila) salen «No aplica» y se activan desde aquí.
    this.dimensionsDraft.set(this.dimensionRow().map((d) => ({ dimension: d.dimension, applies: d.applies, reason: d.reason ?? '' })));
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

  /** Lo que cambió respecto de lo guardado: solo eso se envía (una dimensión sin fila que no se toca no exige motivo). */
  private readonly changedDimensions = computed(() => {
    const base = new Map(this.dimensionRow().map((x) => [x.dimension, x]));
    return this.dimensionsDraft().filter((d) => {
      const b = base.get(d.dimension);
      return !b || d.applies !== b.applies || (!d.applies && d.reason.trim() !== (b.reason ?? '').trim());
    });
  });
  readonly dimensionsValid = computed(() => this.changedDimensions().length > 0 && this.changedDimensions().every((d) => d.applies || d.reason.trim().length > 0));
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
      dimensions: this.changedDimensions().map((d) => ({
        dimension: d.dimension,
        applies: d.applies,
        ...(d.applies ? {} : { reason_not_applicable: d.reason.trim() }),
      })),
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
      error: (error) => this.fail(error),
    });
  }

  protected override fail(error: unknown): void {
    this.fieldErrors.set(Object.fromEntries(apiFieldErrors(error).map((f) => [f.field, f.message])));
    super.fail(error);
  }

  protected override resetFeedback(): void {
    super.resetFeedback();
    this.fieldErrors.set({});
  }
}
