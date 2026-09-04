import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { TemplateFullTree, TemplateTreeCheck, TemplateTreeControl, TemplateTreeReason, TemplateTreeRisk } from '@features/templates/domain/models/template.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

/**
 * Vista puramente informativa de la estructura Riesgo->Causa->Control->Check
 * de un framework (sin evaluación, sin colores de pass/fail) — columnas
 * tipo Miller/Finder: cada nivel abre una columna nueva a la derecha. Los
 * Checks de un control NO abren columna nueva: se expanden debajo del
 * control, dentro de la misma columna de Controles.
 */
@Component({
  selector: 'app-template-view',
  imports: [LoaderComponent],
  templateUrl: './template-view.html',
  styleUrl: './template-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateService = inject(TemplateService);

  private readonly templateId = this.route.snapshot.paramMap.get('id')!;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly template = signal<TemplateFullTree | null>(null);

  readonly selectedRiskId = signal<string | null>(null);
  readonly selectedReasonId = signal<string | null>(null);
  readonly expandedControlIds = signal<Set<string>>(new Set());

  readonly selectedRisk = computed<TemplateTreeRisk | null>(() => {
    const id = this.selectedRiskId();
    return this.template()?.risks.find((r) => r.id === id) ?? null;
  });

  readonly selectedReason = computed<TemplateTreeReason | null>(() => {
    const id = this.selectedReasonId();
    return this.selectedRisk()?.reasons.find((r) => r.id === id) ?? null;
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    this.templateService.getFullTree(this.templateId).subscribe({
      next: (template) => {
        this.template.set(template);
        if (template.risks.length === 1) this.selectRisk(template.risks[0]);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la estructura del template.');
        this.isLoading.set(false);
      },
    });
  }

  selectRisk(risk: TemplateTreeRisk): void {
    this.selectedRiskId.set(risk.id);
    this.selectedReasonId.set(null);
    this.expandedControlIds.set(new Set());
    if (risk.reasons.length === 1) this.selectedReasonId.set(risk.reasons[0].id);
  }

  selectReason(reason: TemplateTreeReason): void {
    this.selectedReasonId.set(reason.id);
    this.expandedControlIds.set(new Set());
  }

  toggleControl(controlId: string): void {
    const next = new Set(this.expandedControlIds());
    next.has(controlId) ? next.delete(controlId) : next.add(controlId);
    this.expandedControlIds.set(next);
  }

  isControlExpanded(controlId: string): boolean {
    return this.expandedControlIds().has(controlId);
  }

  goToCompliance(): void {
    this.router.navigateByUrl(`/templates/${this.templateId}`);
  }

  riskLevelClass(level: string): string {
    switch (level) {
      case 'CRITICAL': return 'bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400';
      case 'HIGH': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400';
      case 'MEDIUM': return 'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
      default: return 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400';
    }
  }

  controlTypeLabel(type: string): string {
    switch (type) {
      case 'AUTOMATIC': return 'Automático';
      case 'HYBRID': return 'Híbrido';
      default: return 'Manual';
    }
  }

  effectiveSoc2Code(check: TemplateTreeCheck): string | null {
    return check.soc2_code ?? check.soc2_code_inferred;
  }
}
