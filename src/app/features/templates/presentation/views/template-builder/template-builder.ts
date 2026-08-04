import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { RiskService } from '@features/templates/domain/services/risk.service';
import { ReasonService } from '@features/templates/domain/services/reason.service';
import { ControlService } from '@features/templates/domain/services/control.service';
import { Control, Reason, Risk, RiskDetail, ReasonDetail, Template } from '@features/templates/domain/models/template.models';
import { ComboboxOption, CreateEntityPayload, EntityCombobox } from '@features/templates/presentation/components/entity-combobox/entity-combobox';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

@Component({
  selector: 'app-template-builder',
  imports: [EntityCombobox, LoaderComponent],
  templateUrl: './template-builder.html',
  styleUrl: './template-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateBuilder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateService = inject(TemplateService);
  private readonly riskService = inject(RiskService);
  private readonly reasonService = inject(ReasonService);
  private readonly controlService = inject(ControlService);

  private readonly templateId = this.route.snapshot.paramMap.get('id')!;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly template = signal<Template | null>(null);

  readonly allRisks = signal<Risk[]>([]);
  readonly allReasons = signal<Reason[]>([]);
  readonly allControls = signal<Control[]>([]);

  readonly selectedRiskId = signal<string | null>(null);
  readonly selectedRisk = signal<RiskDetail | null>(null);
  readonly loadingRisk = signal(false);
  readonly creatingRisk = signal(false);

  readonly selectedReasonId = signal<string | null>(null);
  readonly selectedReason = signal<ReasonDetail | null>(null);
  readonly loadingReason = signal(false);
  readonly creatingReason = signal(false);

  readonly creatingControl = signal(false);
  readonly expandedControlId = signal<string | null>(null);

  readonly riskPool = computed<ComboboxOption[]>(() => {
    const linkedIds = new Set((this.template()?.risks ?? []).map((r) => r.id));
    return this.allRisks()
      .filter((r) => !linkedIds.has(r.id))
      .map((r) => ({ id: r.id, label: r.name, sublabel: r.code }));
  });

  readonly reasonPool = computed<ComboboxOption[]>(() => {
    const linkedIds = new Set((this.selectedRisk()?.reasons ?? []).map((r) => r.id));
    return this.allReasons()
      .filter((r) => !linkedIds.has(r.id))
      .map((r) => ({ id: r.id, label: r.name, sublabel: r.code }));
  });

  readonly controlPool = computed<ComboboxOption[]>(() => {
    const linkedIds = new Set((this.selectedReason()?.controls ?? []).map((c) => c.id));
    return this.allControls()
      .filter((c) => !linkedIds.has(c.id))
      .map((c) => ({ id: c.id, label: c.name, sublabel: c.code }));
  });

  ngOnInit(): void {
    this.loadTemplate();
    this.loadPools();
  }

  private loadTemplate(): void {
    this.isLoading.set(true);
    this.templateService.getById(this.templateId).subscribe({
      next: (template) => {
        this.template.set(template);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo cargar el template.');
      },
    });
  }

  private loadPools(): void {
    forkJoin({
      risks: this.riskService.getAll(),
      reasons: this.reasonService.getAll(),
      controls: this.controlService.getAll(),
    }).subscribe(({ risks, reasons, controls }) => {
      this.allRisks.set(risks);
      this.allReasons.set(reasons);
      this.allControls.set(controls);
    });
  }

  goBack(): void {
    this.router.navigateByUrl('/templates');
  }

  // ---- Columna 1: riesgos ----

  selectRisk(id: string): void {
    if (this.selectedRiskId() === id) return;
    this.selectedRiskId.set(id);
    this.selectedReasonId.set(null);
    this.selectedReason.set(null);
    this.expandedControlId.set(null);
    this.loadingRisk.set(true);
    this.riskService.getById(id).subscribe({
      next: (risk) => {
        this.selectedRisk.set(risk);
        this.loadingRisk.set(false);
      },
      error: () => {
        this.loadingRisk.set(false);
        this.errorMessage.set('No se pudo cargar el riesgo.');
      },
    });
  }

  linkRisk(riskId: string): void {
    this.riskService.update(riskId, { templateId: this.templateId }).subscribe(() => {
      this.loadTemplate();
      this.loadPools();
    });
  }

  createRisk(payload: CreateEntityPayload): void {
    this.creatingRisk.set(true);
    this.riskService
      .create({ name: payload.name, impact: payload.impact ?? 3, probability: payload.probability ?? 3, templateId: this.templateId })
      .subscribe({
        next: () => {
          this.creatingRisk.set(false);
          this.loadTemplate();
          this.loadPools();
        },
        error: () => {
          this.creatingRisk.set(false);
          this.errorMessage.set('No se pudo crear el riesgo.');
        },
      });
  }

  // ---- Columna 2: causas ----

  selectReason(id: string): void {
    if (this.selectedReasonId() === id) return;
    this.selectedReasonId.set(id);
    this.expandedControlId.set(null);
    this.loadingReason.set(true);
    this.reasonService.getById(id).subscribe({
      next: (reason) => {
        this.selectedReason.set(reason);
        this.loadingReason.set(false);
      },
      error: () => {
        this.loadingReason.set(false);
        this.errorMessage.set('No se pudo cargar la causa.');
      },
    });
  }

  private refreshSelectedRisk(): void {
    const riskId = this.selectedRiskId();
    if (!riskId) return;
    this.riskService.getById(riskId).subscribe((risk) => this.selectedRisk.set(risk));
  }

  linkReason(reasonId: string): void {
    const riskId = this.selectedRiskId();
    if (!riskId) return;
    this.reasonService.linkRisks(reasonId, { riskIds: [riskId] }).subscribe(() => {
      this.refreshSelectedRisk();
      this.loadPools();
    });
  }

  createReason(payload: CreateEntityPayload): void {
    const riskId = this.selectedRiskId();
    if (!riskId) return;
    this.creatingReason.set(true);
    this.reasonService.create({ name: payload.name }).subscribe({
      next: (reason) => {
        this.reasonService.linkRisks(reason.id, { riskIds: [riskId] }).subscribe({
          next: () => {
            this.creatingReason.set(false);
            this.refreshSelectedRisk();
            this.loadPools();
          },
          error: () => {
            this.creatingReason.set(false);
            this.errorMessage.set('No se pudo vincular la causa al riesgo.');
          },
        });
      },
      error: () => {
        this.creatingReason.set(false);
        this.errorMessage.set('No se pudo crear la causa.');
      },
    });
  }

  // ---- Columna 3: controles ----

  toggleControl(id: string): void {
    this.expandedControlId.update((current) => (current === id ? null : id));
  }

  private refreshSelectedReason(): void {
    const reasonId = this.selectedReasonId();
    if (!reasonId) return;
    this.reasonService.getById(reasonId).subscribe((reason) => this.selectedReason.set(reason));
  }

  linkControl(controlId: string): void {
    const reasonId = this.selectedReasonId();
    if (!reasonId) return;
    this.reasonService.linkControls(reasonId, { controlIds: [controlId] }).subscribe(() => {
      this.refreshSelectedReason();
      this.loadPools();
    });
  }

  createControl(payload: CreateEntityPayload): void {
    const reasonId = this.selectedReasonId();
    if (!reasonId) return;
    this.creatingControl.set(true);
    this.controlService.create({ name: payload.name }).subscribe({
      next: (control) => {
        this.reasonService.linkControls(reasonId, { controlIds: [control.id] }).subscribe({
          next: () => {
            this.creatingControl.set(false);
            this.refreshSelectedReason();
            this.loadPools();
          },
          error: () => {
            this.creatingControl.set(false);
            this.errorMessage.set('No se pudo vincular el control a la causa.');
          },
        });
      },
      error: () => {
        this.creatingControl.set(false);
        this.errorMessage.set('No se pudo crear el control.');
      },
    });
  }
}
