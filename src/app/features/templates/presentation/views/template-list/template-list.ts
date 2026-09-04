import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { CreateTemplateDto, Template } from '@features/templates/domain/models/template.models';
import { CreateTemplateForm } from '@features/templates/presentation/components/create-template-form/create-template-form';
import { DashboardService } from '@features/dashboard/domain/services/dashboard.service';
import { DashboardSummary } from '@features/dashboard/domain/models/dashboard.models';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { getPercentBarClass, getPercentTextClass } from '@shared/domain/utils/dimension-display.util';

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
  private readonly route = inject(ActivatedRoute);
  /** 'compliance' (default, /templates) muestra evaluación; 'structure' (/plantilla) solo navega a la estructura cruda. */
  private readonly mode = (this.route.snapshot.data['mode'] as 'compliance' | 'structure') ?? 'compliance';
  readonly isStructureMode = this.mode === 'structure';

  readonly isLoading = signal(false);
  readonly templates = signal<Template[]>([]);
  readonly complianceByTemplateId = signal<Map<string, number | null>>(new Map());
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly getPercentBarClass = getPercentBarClass;
  readonly getPercentTextClass = getPercentTextClass;

  ngOnInit(): void {
    this.readTemplates();
  }

  readTemplates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.templateService
      .getAll()
      .pipe(
        switchMap((templates) =>
          templates.length && !this.isStructureMode
            ? forkJoin({ templates: of(templates), summaryResp: this.dashboardService.readSummary(templates[0].id) })
            : forkJoin({ templates: of(templates), summaryResp: of(null) }),
        ),
      )
      .subscribe({
        next: ({ templates, summaryResp }) => {
          this.templates.set(templates);
          const summary = (summaryResp as SuccessResponse<DashboardSummary> | null)?.data ?? null;
          const byId = new Map<string, number | null>();
          for (const t of summary?.contractedTemplates ?? []) byId.set(t.id, t.compliance);
          this.complianceByTemplateId.set(byId);
          this.isLoading.set(false);
          this.showCreateForm.set(templates.length === 0);
        },
        error: () => {
          this.isLoading.set(false);
          this.errorMessage.set('No se pudieron cargar tus templates.');
        },
      });
  }

  complianceFor(templateId: string): number | null {
    return this.complianceByTemplateId().get(templateId) ?? null;
  }

  open(template: Template): void {
    if (this.isStructureMode) {
      this.router.navigateByUrl(`/plantilla/${template.id}`);
      return;
    }
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
