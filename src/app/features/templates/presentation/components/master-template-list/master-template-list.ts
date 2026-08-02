import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MasterTemplate } from '@features/templates/domain/models/template.models';

@Component({
  selector: 'app-master-template-list',
  imports: [],
  templateUrl: './master-template-list.html',
  styleUrl: './master-template-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MasterTemplateList {
  @Input({ required: true }) templates: MasterTemplate[] = [];
  @Input() adoptingId: string | null = null;
  @Output() adopt = new EventEmitter<string>();
}
