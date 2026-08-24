import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { TemplateFullTree, TemplateTreeCheck } from '@features/templates/domain/models/template.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

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
  readonly expandedRiskIds = signal<Set<string>>(new Set());
  readonly expandedControlIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.isLoading.set(true);
    this.templateService.getFullTree(this.templateId).subscribe({
      next: (template) => {
        this.template.set(template);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la estructura del template.');
        this.isLoading.set(false);
      },
    });
  }

  toggleRisk(riskId: string): void {
    const next = new Set(this.expandedRiskIds());
    next.has(riskId) ? next.delete(riskId) : next.add(riskId);
    this.expandedRiskIds.set(next);
  }

  isRiskExpanded(riskId: string): boolean {
    return this.expandedRiskIds().has(riskId);
  }

  toggleControl(controlId: string): void {
    const next = new Set(this.expandedControlIds());
    next.has(controlId) ? next.delete(controlId) : next.add(controlId);
    this.expandedControlIds.set(next);
  }

  isControlExpanded(controlId: string): boolean {
    return this.expandedControlIds().has(controlId);
  }

  edit(): void {
    this.router.navigateByUrl(`/templates/${this.templateId}/build`);
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

  ccGroups(checks: TemplateTreeCheck[]): string[] {
    const groups = new Set<string>();
    for (const check of checks) {
      const code = this.effectiveSoc2Code(check);
      if (!code) continue;
      for (const match of code.match(/[A-Z]+\d+(\.\d+)?/g) ?? []) {
        groups.add(match);
      }
    }
    return Array.from(groups).sort();
  }

  effectiveSoc2Code(check: TemplateTreeCheck): string | null {
    return check.soc2_code ?? check.soc2_code_inferred;
  }

  isCheckMappingConfirmed(check: TemplateTreeCheck): boolean {
    return !!check.soc2_code;
  }

  isCheckMappingProposed(check: TemplateTreeCheck): boolean {
    return !check.soc2_code && !!check.soc2_code_inferred;
  }
}
