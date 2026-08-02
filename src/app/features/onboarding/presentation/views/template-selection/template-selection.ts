import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TemplateService } from '@features/templates/domain/services/template.service';
import { CreateTemplateDto, MasterTemplate } from '@features/templates/domain/models/template.models';
import { MasterTemplateList } from '@features/templates/presentation/components/master-template-list/master-template-list';
import { CreateTemplateForm } from '@features/templates/presentation/components/create-template-form/create-template-form';

@Component({
  selector: 'app-template-selection',
  imports: [MasterTemplateList, CreateTemplateForm],
  templateUrl: './template-selection.html',
  styleUrl: './template-selection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateSelection implements OnInit {
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);

  readonly masterTemplates = signal<MasterTemplate[]>([]);
  readonly mode = signal<'adopt' | 'create'>('adopt');
  readonly adoptingId = signal<string | null>(null);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.templateService.getMasterTemplates().subscribe({
      next: (templates) => this.masterTemplates.set(templates),
      error: () => this.errorMessage.set('No se pudieron cargar los templates maestros.'),
    });
  }

  adopt(id: string): void {
    this.adoptingId.set(id);
    this.errorMessage.set(null);

    this.templateService.adoptMasterTemplate(id).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => {
        this.adoptingId.set(null);
        this.errorMessage.set('No se pudo adoptar el template.');
      },
    });
  }

  create(dto: CreateTemplateDto): void {
    this.creating.set(true);
    this.errorMessage.set(null);

    this.templateService.create(dto).subscribe({
      next: (template) => this.router.navigateByUrl(`/onboarding/templates/${template.id}/build`),
      error: () => {
        this.creating.set(false);
        this.errorMessage.set('No se pudo crear el template.');
      },
    });
  }
}
