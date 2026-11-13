import { storedLanguage } from '@core/domain/services/language.service';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Cause } from '@shared/domain/models/risk.models';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { RiskForm } from '../risk-form/risk-form';
import { targetValue } from '@shared/presentation/utils/event-target';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';

type Stage = 'loading' | 'error' | 'ready';

// D93 · Las causas de un riesgo recién agregado. Se elige entre las causas del servicio (una lista que se busca) o se crea una nueva, que queda ligada al riesgo. Cada marca
// se guarda en el momento (vincular o desvincular), así que no hay un «guardar» que olvidar. Es opcional: quien no marca ninguna sigue y puede hacerlo después en Cumplimiento.
@Component({
  selector: 'app-risk-causes-picker',
  imports: [Badge, Tag, TranslatePipe, Skeleton, SkeletonRegion, RiskForm, SearchField],
  templateUrl: './risk-causes-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskCausesPicker {
  protected readonly targetValue = targetValue;
  private readonly api = inject(RiskService);
  private readonly translate = inject(TranslateService);
  readonly labels = inject(EnumLabelService);

  readonly serviceId = input.required<string>();
  readonly riskId = input.required<string>();
  readonly riskName = input.required<string>();
  /** La persona terminó de elegir (con o sin causas). */
  readonly done = output<void>();

  readonly stage = signal<Stage>('loading');
  readonly causes = signal<Cause[]>([]);
  /** Las causas ligadas a este riesgo. */
  readonly linked = signal<ReadonlySet<string>>(new Set());
  readonly busy = signal<ReadonlySet<string>>(new Set());
  readonly query = signal('');
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.causes();
    return q ? all.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) : all;
  });
  readonly count = computed(() => this.linked().size);

  constructor() {
    effect(() => {
      this.riskId();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({ causes: this.api.listAllCauses(this.serviceId()), risk: this.api.getRisk(this.riskId()) }).subscribe({
      next: ({ causes, risk }) => {
        this.causes.set(causes.filter((c) => c.is_active).sort((a, b) => a.code.localeCompare(b.code, storedLanguage(), { numeric: true })));
        this.linked.set(new Set(risk.causes.map((c) => c.id)));
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  isLinked(id: string): boolean {
    return this.linked().has(id);
  }

  toggle(cause: Cause): void {
    if (this.busy().has(cause.id)) return;
    const on = !this.isLinked(cause.id);
    this.mark(this.busy, cause.id, true);
    this.error.set(null);
    (on ? this.api.linkCause(this.riskId(), cause.id) : this.api.unlinkCause(this.riskId(), cause.id)).subscribe({
      next: () => {
        this.mark(this.busy, cause.id, false);
        this.mark(this.linked, cause.id, on);
      },
      error: (e) => {
        this.mark(this.busy, cause.id, false);
        this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_WIZARD.CAUSES_ERROR')));
      },
    });
  }

  /** Se creó una causa nueva en el formulario: se suma a la lista y se liga a este riesgo. */
  onCreated(causeId: string): void {
    this.creating.set(false);
    this.error.set(null);
    this.api.getCause(causeId).subscribe({
      next: (cause) => {
        this.causes.update((list) => [...list, cause].sort((a, b) => a.code.localeCompare(b.code, storedLanguage(), { numeric: true })));
        this.toggle(cause);
      },
      error: (e) => this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_WIZARD.CAUSES_ERROR'))),
    });
  }

  private mark(target: { update: (fn: (s: ReadonlySet<string>) => ReadonlySet<string>) => void }, id: string, on: boolean): void {
    target.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
