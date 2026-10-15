import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, forkJoin, of } from 'rxjs';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { COMPLIANCE_ROUTE } from '../../../domain/models/compliance.models';
import { Cause, RiskListItem } from '../../../domain/models/risk.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { RiskService } from '../../../domain/services/risk.service';
import { CauseDetailPanel } from '../../components/cause-detail-panel/cause-detail-panel';
import { RiskDetailPanel } from '../../components/risk-detail-panel/risk-detail-panel';
import { RiskLevelBadge } from '../../components/risk-level-badge/risk-level-badge';

type Stage = 'loading' | 'error' | 'ready';
type Section = 'risks' | 'causes';

const ALL = 'all';

interface Group<T> {
  key: string;
  label: string;
  items: T[];
}

// Las pestañas «Riesgos» y «Causas» de un servicio (MD-124). Es la misma vista con dos rutas: `data.section` dice cuál es. Una causa no depende de un riesgo
// (10 de las 56 del catálogo no pertenecen a ninguno), así que tiene su propia pestaña. Un servicio trae unos 10 riesgos y 56 causas: se cargan completos y
// se agrupan aquí por los valores que llegan (criterio del riesgo, categoría de falla de la causa); el backend no sirve esas listas, no se escriben a mano.
// Un riesgo sin evaluar no es «bajo»: se muestra «Sin evaluar» hasta que exista la evaluación (MD-123).
@Component({
  selector: 'app-risks',
  imports: [FormsModule, TranslatePipe, OptionChips, LoadingSpinner, RiskLevelBadge, RiskDetailPanel, CauseDetailPanel],
  templateUrl: './risks.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RisksView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RiskService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // La vista es hija de `services/:id/cumplimiento`: el id del servicio está en la ruta del padre.
  private readonly params = toSignal(this.route.parent!.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

  private readonly data = toSignal(this.route.data, { requireSync: true });
  readonly section = computed<Section>(() => (this.data()['section'] === 'causes' ? 'causes' : 'risks'));

  // `?abrir=<id>` abre directamente el drawer de esa causa o riesgo (se usa al saltar de una pestaña a la otra).
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly stage = signal<Stage>('loading');
  readonly risks = signal<RiskListItem[]>([]);
  readonly causes = signal<Cause[]>([]);

  readonly query = signal('');
  readonly group = signal<string | null>(null);

  readonly selectedRisk = signal<string | null>(null);
  readonly selectedCause = signal<string | null>(null);

  private requestSeq = 0;

  private readonly groupPrefix = computed(() => (this.section() === 'risks' ? 'COMPLIANCE.RISK_CRITERION' : 'COMPLIANCE.FAILURE_CATEGORY'));
  private readonly groupOf = (item: RiskListItem | Cause): string => ('trust_criterion' in item ? item.trust_criterion : item.failure_category);

  readonly current = computed<(RiskListItem | Cause)[]>(() => (this.section() === 'risks' ? this.risks() : this.causes()));

  /** Los grupos que existen en los datos, con su texto, ordenados por texto. */
  private readonly groupKeys = computed(() => {
    const keys = [...new Set(this.current().map((i) => this.groupOf(i)))];
    return keys.sort((a, b) => this.labels.of(this.groupPrefix(), a).localeCompare(this.labels.of(this.groupPrefix(), b), 'es'));
  });

  readonly chips = computed(() => [
    { value: ALL, label: this.labels.of('COMPLIANCE.RISKS', 'ALL') },
    ...this.groupKeys().map((k) => ({ value: k, label: this.labels.of(this.groupPrefix(), k) })),
  ]);

  private readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const g = this.group();
    return this.current().filter((i) => (!g || this.groupOf(i) === g) && (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  });

  readonly riskGroups = computed<Group<RiskListItem>[]>(() => this.grouped(this.filtered() as RiskListItem[]));
  readonly causeGroups = computed<Group<Cause>[]>(() => this.grouped(this.filtered() as Cause[]));
  readonly visibleCount = computed(() => this.filtered().length);
  readonly hasFilters = computed(() => this.group() !== null || this.query().trim() !== '');

  constructor() {
    effect(() => {
      this.serviceId();
      this.section();
      this.view.viewParam();
      untracked(() => this.load());
    });
    // Llegar con `?abrir=` abre ese elemento en la pestaña que corresponde.
    effect(() => {
      const id = this.queryParams().get('abrir');
      if (!id) return;
      untracked(() => (this.section() === 'risks' ? this.selectedRisk.set(id) : this.selectedCause.set(id)));
    });
  }

  load(): void {
    const seq = ++this.requestSeq;
    this.stage.set('loading');
    this.fetch().subscribe({
      next: ({ risks, causes }) => {
        if (seq !== this.requestSeq) return;
        this.risks.set(risks);
        this.causes.set(causes);
        this.stage.set('ready');
      },
      error: () => {
        if (seq !== this.requestSeq) return;
        this.stage.set('error');
      },
    });
  }

  /** Vuelve a pedir los datos sin parpadear: se usa cuando un drawer cambió algo (un vínculo, una baja). */
  refresh(): void {
    const seq = ++this.requestSeq;
    this.fetch().subscribe({
      next: ({ risks, causes }) => {
        if (seq !== this.requestSeq) return;
        this.risks.set(risks);
        this.causes.set(causes);
      },
    });
  }

  pickGroup(value: string): void {
    this.group.set(value === ALL || value === this.group() ? null : value);
  }

  clearFilters(): void {
    this.group.set(null);
    this.query.set('');
  }

  /** Abre un riesgo: aquí mismo si estamos en Riesgos, o saltando a esa pestaña si venimos de una causa. */
  openRisk(id: string): void {
    if (this.section() === 'risks') this.selectedRisk.set(id);
    else this.jump('riesgos', id);
  }

  /** Abre una causa: aquí mismo si estamos en Causas, o saltando a esa pestaña si venimos de un riesgo. */
  openCause(id: string): void {
    if (this.section() === 'causes') this.selectedCause.set(id);
    else this.jump('causas', id);
  }

  closeRisk(): void {
    this.selectedRisk.set(null);
    this.clearOpenParam();
  }

  closeCause(): void {
    this.selectedCause.set(null);
    this.clearOpenParam();
  }

  private jump(tab: 'riesgos' | 'causas', id: string): void {
    this.router.navigate(['/services', this.serviceId(), COMPLIANCE_ROUTE, tab], { queryParams: { abrir: id } });
  }

  private clearOpenParam(): void {
    if (this.queryParams().get('abrir')) this.router.navigate([], { relativeTo: this.route, queryParams: { abrir: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // Solo se pide lo que la pestaña muestra: riesgos en Riesgos, causas en Causas.
  private fetch(): Observable<{ risks: RiskListItem[]; causes: Cause[] }> {
    const view = this.view.viewParam();
    const id = this.serviceId();
    return forkJoin({
      risks: this.section() === 'risks' ? this.api.listAllRisks(id, view) : of([] as RiskListItem[]),
      causes: this.section() === 'causes' ? this.api.listAllCauses(id, view) : of([] as Cause[]),
    });
  }

  private grouped<T extends RiskListItem | Cause>(items: T[]): Group<T>[] {
    const prefix = this.groupPrefix();
    const by = new Map<string, T[]>();
    for (const i of items) {
      const k = this.groupOf(i);
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    return [...by.entries()]
      .map(([key, list]) => ({ key, label: this.labels.of(prefix, key), items: list.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }
}
