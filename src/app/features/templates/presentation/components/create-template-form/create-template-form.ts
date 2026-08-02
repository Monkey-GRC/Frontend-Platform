import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import { CreateTemplateDto } from '@features/templates/domain/models/template.models';

@Component({
  selector: 'app-create-template-form',
  imports: [ReactiveFormsModule],
  templateUrl: './create-template-form.html',
  styleUrl: './create-template-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTemplateForm {
  private readonly fb = inject(FormBuilder);

  @Input() loading = false;
  @Output() create = new EventEmitter<CreateTemplateDto>();

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    description: [''],
    objective: [''],
    scope: [''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.create.emit(this.form.getRawValue());
  }
}
