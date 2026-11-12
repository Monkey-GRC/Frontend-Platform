import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { Select, SelectOption } from '@shared/presentation/components/select/select';

export interface PickerItem {
  id: string;
  label: string;
}

let nextId = 0;

// Elegir una opción de una lista para vincularla (una causa a un riesgo, un control a una causa). Las opciones llegan ya filtradas (sin las que
// ya están vinculadas); el campo de texto acota la lista cuando es larga. No decide nada: avisa qué se eligió y quien lo usa llama a la API.
@Component({
  selector: 'app-link-picker',
  imports: [TranslatePipe, SearchField, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-ink-muted" [for]="id + '-filter'">{{ labelKey() | translate }}</label>
      <app-search-field [inputId]="id + '-filter'" placeholderKey="COMPLIANCE.LINK.SEARCH" [ariaLabelKey]="labelKey()" [value]="query()" (valueChange)="query.set($event)" />
      <app-select [inputId]="id + '-select'" [ariaLabelKey]="labelKey()" [options]="options()" [value]="selected() ?? ''" [disabled]="options().length === 0" [placeholderKey]="options().length ? 'COMPLIANCE.LINK.PLACEHOLDER' : 'COMPLIANCE.LINK.NOTHING_TO_LINK'" (valueChange)="selected.set($event || null)" />
      <div class="flex items-center gap-3">
        <button type="button" (click)="confirm()" [disabled]="!selected() || busy()"
          class="h-9 shadow mk-btn">{{ 'COMPLIANCE.LINK.LINK' | translate }}</button>
        <button type="button" (click)="cancelled.emit()" [disabled]="busy()" class="text-sm font-medium text-ink-muted enabled:hover:underline disabled:cursor-not-allowed disabled:text-ink-faint">{{ 'COMMON.CANCEL' | translate }}</button>
      </div>
    </div>
  `,
})
export class LinkPicker {
  readonly labelKey = input.required<string>();
  readonly items = input.required<PickerItem[]>();
  readonly busy = input(false);

  readonly picked = output<string>();
  readonly cancelled = output<void>();

  protected readonly id = `link-picker-${nextId++}`;
  protected readonly query = signal('');
  protected readonly selected = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.items().filter((i) => i.label.toLowerCase().includes(q)) : this.items();
  });

  // Sin opciones, un texto en lugar de la lista (antes, una opción deshabilitada).
  protected readonly options = computed<SelectOption[]>(() => this.visible().map((i) => ({ value: i.id, label: i.label })));

  protected confirm(): void {
    const id = this.selected();
    if (id) this.picked.emit(id);
  }
}
