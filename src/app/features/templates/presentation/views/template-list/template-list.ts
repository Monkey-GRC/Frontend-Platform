import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { CreateTemplateDto, Template } from '@features/templates/domain/models/template.models';
import { CreateTemplateForm } from '@features/templates/presentation/components/create-template-form/create-template-form';
import { LoaderComponent } from '@shared/presentation/components/loader/loader.component';

@Component({
  selector: 'app-template-list',
  imports: [CreateTemplateForm, LoaderComponent],
  templateUrl: './template-list.html',
  styleUrl: './template-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateList implements OnInit {
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly templates = signal<Template[]>([]);
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.readTemplates();
  }

  readTemplates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.templateService.getAll().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.isLoading.set(false);
        this.showCreateForm.set(templates.length === 0);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron cargar tus templates.');
      },
    });
  }

  build(templateId: string): void {
    this.router.navigateByUrl(`/templates/${templateId}/build`);
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
