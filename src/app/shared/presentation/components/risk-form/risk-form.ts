import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Cause, RiskDetail } from '@shared/domain/models/risk.models';
import { RiskService } from '@shared/domain/services/risk.service';
import { targetValue, targetChecked } from '@shared/presentation/utils/event-target';
import { Select } from '@shared/presentation/components/select/select';

export type RiskFormKind = 'risk' | 'cause';

// Alta y edición de un riesgo o de una causa propios de la empresa (MD-124). Es el mismo panel para los dos: el riesgo pide además el impacto potencial. El código lo asigna
// el servidor. Las listas (criterio, categoría de falla, tipos de pérdida) salen del backend (`GET /v1/catalogs/{nombre}`); los errores por campo del backend se muestran junto a
// cada campo. Solo lo puede abrir el administrador de la empresa.
@Component({
  selector: 'app-risk-form',
  imports: [TranslatePipe, FormModal, Select],
  templateUrl: './risk-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskForm implements OnInit {
  protected readonly targetValue = targetValue;
  protected readonly targetChecked = targetChecked;
  private readonly api = inject(RiskService);
  private readonly translate = inject(TranslateService);
  private readonly catalogs = inject(CatalogService);

  readonly kind = input.required<RiskFormKind>();
  readonly serviceId = input.required<string>();
  /** Al editar: el riesgo o la causa tal como los devuelve el detalle. Sin él, se crea uno nuevo. */
  readonly existing = input<RiskDetail | Cause | null>(null);

  /** Se guardó: el id del riesgo o la causa. */
  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly criteria = toSignal(this.catalogs.options('risk_criterion'), { initialValue: [] });
  readonly categories = toSignal(this.catalogs.options('failure_category'), { initialValue: [] });
  readonly losses = toSignal(this.catalogs.options('loss_type'), { initialValue: [] });

  readonly name = signal('');
  readonly description = signal('');
  readonly group = signal('');
  readonly impacts = signal<string[]>([]);

  readonly sending = signal(false);
  readonly banner = signal<string | null>(null);
  readonly errors = signal<Record<string, string>>({});

  readonly editing = computed(() => this.existing() !== null);
  readonly groups = computed(() => (this.kind() === 'risk' ? this.criteria() : this.categories()));
  private original: { name: string; description: string; group: string; impacts: string[] } | null = null;

  /** Al editar solo se puede guardar si algo cambió. */
  readonly canSave = computed(() => {
    if (this.sending()) return false;
    const o = this.original;
    if (!o) return true;
    return this.name() !== o.name || this.description() !== o.description || this.group() !== o.group || this.impacts().join() !== o.impacts.join();
  });

  ngOnInit(): void {
    const e = this.existing();
    if (!e) return;
    const group = 'trust_criterion' in e ? e.trust_criterion : e.failure_category;
    const impacts = 'potential_impact' in e ? [...e.potential_impact] : [];
    this.name.set(e.name);
    this.description.set(e.description);
    this.group.set(group);
    this.impacts.set(impacts);
    this.original = { name: e.name, description: e.description, group, impacts };
  }

  toggleImpact(value: string, on: boolean): void {
    this.impacts.update((list) => (on ? [...list, value] : list.filter((v) => v !== value)));
  }

  save(): void {
    this.banner.set(null);
    const errors: Record<string, string> = {};
    const required = this.translate.instant('COMPLIANCE.RISK_FORM.REQUIRED');
    if (!this.name().trim()) errors['name'] = required;
    if (!this.description().trim()) errors['description'] = required;
    if (!this.group()) errors[this.groupField()] = required;
    this.errors.set(errors);
    if (Object.keys(errors).length || this.sending()) return;

    this.sending.set(true);
    this.send().subscribe({
      next: (saved) => {
        this.sending.set(false);
        this.saved.emit(saved.id);
      },
      error: (e) => {
        this.sending.set(false);
        const fields = apiFieldErrors(e);
        if (fields.length) this.errors.set(Object.fromEntries(fields.map((f) => [f.field, f.message])));
        else this.banner.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_FORM.SAVE_ERROR')));
      },
    });
  }

  groupField(): string {
    return this.kind() === 'risk' ? 'trust_criterion' : 'failure_category';
  }

  private send(): Observable<{ id: string }> {
    const base = { name: this.name().trim(), description: this.description().trim() };
    const existing = this.existing();
    if (this.kind() === 'risk') {
      const body = { ...base, trust_criterion: this.group(), potential_impact: this.impacts() };
      return existing ? this.api.updateRisk(existing.id, body) : this.api.createRisk(this.serviceId(), body);
    }
    const body = { ...base, failure_category: this.group() };
    return existing ? this.api.updateCause(existing.id, body) : this.api.createCause(this.serviceId(), body);
  }
}
