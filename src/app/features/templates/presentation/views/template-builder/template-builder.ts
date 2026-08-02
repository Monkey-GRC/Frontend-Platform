import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistService } from '@features/templates/domain/services/checklist.service';
import { ControlService } from '@features/templates/domain/services/control.service';
import { RiskService } from '@features/templates/domain/services/risk.service';
import { ReasonService } from '@features/templates/domain/services/reason.service';
import {
  ChecklistItem,
  Control,
  ControlType,
  OperatingSystem,
  Reason,
  Risk,
} from '@features/templates/domain/models/template.models';

@Component({
  selector: 'app-template-builder',
  imports: [ReactiveFormsModule],
  templateUrl: './template-builder.html',
  styleUrl: './template-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateBuilder {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checklistService = inject(ChecklistService);
  private readonly controlService = inject(ControlService);
  private readonly riskService = inject(RiskService);
  private readonly reasonService = inject(ReasonService);

  readonly templateId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly section = signal<'controls' | 'risks' | 'reasons'>('controls');
  readonly sections = ['controls', 'risks', 'reasons'] as const;

  readonly controls = signal<Control[]>([]);
  readonly risks = signal<Risk[]>([]);
  readonly reasons = signal<Reason[]>([]);

  readonly checklistResults = signal<ChecklistItem[]>([]);
  readonly selectedChecklistIds = signal<Set<string>>(new Set());
  readonly savingControl = signal(false);
  readonly savingRisk = signal(false);
  readonly savingReason = signal(false);
  readonly selectedRiskIds = signal<Set<string>>(new Set());
  readonly selectedControlIds = signal<Set<string>>(new Set());
  readonly errorMessage = signal<string | null>(null);

  readonly controlForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    objective: [''],
    type: ['AUTOMATIC' as ControlType],
    os: ['UBUNTU' as OperatingSystem],
  });

  readonly checklistSearchForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly riskForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    impact: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    probability: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
  });

  readonly reasonForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  searchChecklist(): void {
    const os = this.controlForm.controls.os.value;
    const search = this.checklistSearchForm.controls.search.value;
    this.checklistService.search(os, search || undefined).subscribe({
      next: (items) => this.checklistResults.set(items),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de checks.'),
    });
  }

  toggleChecklistItem(checkId: string): void {
    const current = new Set(this.selectedChecklistIds());
    if (current.has(checkId)) {
      current.delete(checkId);
    } else {
      current.add(checkId);
    }
    this.selectedChecklistIds.set(current);
  }

  createControl(): void {
    if (this.controlForm.invalid) {
      this.controlForm.markAllAsTouched();
      return;
    }

    this.savingControl.set(true);
    this.errorMessage.set(null);

    const checklist = this.checklistResults()
      .filter((item) => this.selectedChecklistIds().has(item.checkId))
      .map((item) => ({ checkId: item.checkId, title: item.title }));

    this.controlService.create({ ...this.controlForm.getRawValue(), checklist }).subscribe({
      next: (control) => {
        this.controls.update((list) => [...list, control]);
        this.controlForm.reset({ type: 'AUTOMATIC', os: 'UBUNTU', name: '', description: '', objective: '' });
        this.selectedChecklistIds.set(new Set());
        this.checklistResults.set([]);
        this.savingControl.set(false);
      },
      error: () => {
        this.savingControl.set(false);
        this.errorMessage.set('No se pudo crear el control.');
      },
    });
  }

  createRisk(): void {
    if (this.riskForm.invalid) {
      this.riskForm.markAllAsTouched();
      return;
    }

    this.savingRisk.set(true);
    this.errorMessage.set(null);

    this.riskService.create({ ...this.riskForm.getRawValue(), templateId: this.templateId }).subscribe({
      next: (risk) => {
        this.risks.update((list) => [...list, risk]);
        this.riskForm.reset({ name: '', description: '', impact: 3, probability: 3 });
        this.savingRisk.set(false);
      },
      error: () => {
        this.savingRisk.set(false);
        this.errorMessage.set('No se pudo crear el riesgo.');
      },
    });
  }

  toggleRiskLink(id: string): void {
    const current = new Set(this.selectedRiskIds());
    current.has(id) ? current.delete(id) : current.add(id);
    this.selectedRiskIds.set(current);
  }

  toggleControlLink(id: string): void {
    const current = new Set(this.selectedControlIds());
    current.has(id) ? current.delete(id) : current.add(id);
    this.selectedControlIds.set(current);
  }

  createReason(): void {
    if (this.reasonForm.invalid) {
      this.reasonForm.markAllAsTouched();
      return;
    }

    this.savingReason.set(true);
    this.errorMessage.set(null);

    this.reasonService.create(this.reasonForm.getRawValue()).subscribe({
      next: (reason) => {
        const riskIds = Array.from(this.selectedRiskIds());
        const controlIds = Array.from(this.selectedControlIds());

        this.reasonService.linkRisks(reason.id, { riskIds }).subscribe();
        this.reasonService.linkControls(reason.id, { controlIds }).subscribe();

        this.reasons.update((list) => [...list, reason]);
        this.reasonForm.reset({ name: '', description: '' });
        this.selectedRiskIds.set(new Set());
        this.selectedControlIds.set(new Set());
        this.savingReason.set(false);
      },
      error: () => {
        this.savingReason.set(false);
        this.errorMessage.set('No se pudo crear el motivo.');
      },
    });
  }

  finish(): void {
    this.router.navigateByUrl('/');
  }
}
