import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { CreateTemplateDto, Template } from '@features/templates/domain/models/template.models';
import { CreateTemplateForm } from '@features/templates/presentation/components/create-template-form/create-template-form';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import { DashboardSummary } from '@features/dashboard/domain/models/dashboard.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { SuccessResponse } from '@shared/domain/models/api-response.model';

@Component({
  selector: 'app-template-list',
  imports: [CreateTemplateForm, LoaderComponent],
  templateUrl: './template-list.html',
  styleUrl: './template-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateList implements OnInit {
  private readonly templateService = inject(TemplateService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly templates = signal<Template[]>([]);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.readTemplates();
  }

  readTemplates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      templates: this.templateService.getAll(),
      summaryResp: this.dashboardService.readSummary(),
    }).subscribe({
      next: ({ templates, summaryResp }) => {
        this.templates.set(templates);
        this.summary.set((summaryResp as SuccessResponse<DashboardSummary>).data ?? null);
        this.isLoading.set(false);
        this.showCreateForm.set(templates.length === 0);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron cargar tus templates.');
      },
    });
  }

  readinessLabel(): string {
    const percent = this.summary()?.frameworkCompliance ?? null;
    if (percent === null) return 'Sin evaluar todavía';
    if (percent >= 90) return 'Preparado';
    if (percent >= 50) return 'Casi listo';
    return 'Requiere trabajo';
  }

  readinessDotClass(): string {
    const percent = this.summary()?.frameworkCompliance ?? null;
    if (percent === null) return 'bg-gray-300 dark:bg-gray-600';
    if (percent >= 90) return 'bg-success-500';
    if (percent >= 50) return 'bg-warning-500';
    return 'bg-error-500';
  }

  open(template: Template): void {
    const hasContent = (template.risks?.length ?? 0) > 0;
    this.router.navigateByUrl(hasContent ? `/templates/${template.id}` : `/templates/${template.id}/build`);
  }

  create(dto: CreateTemplateDto): void {
    this.creating.set(true);
    this.errorMessage.set(null);

    this.templateService.create(dto).subscribe({
      next: (template) => {
        this.creating.set(false);
        this.router.navigateByUrl(`/templates/${template.id}/build`);
      },
      error: () => {
        this.creating.set(false);
        this.errorMessage.set('No se pudo crear el template.');
      },
    });
  }
}
