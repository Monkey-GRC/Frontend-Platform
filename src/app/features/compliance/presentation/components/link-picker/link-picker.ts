import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export interface PickerItem {
  id: string;
  label: string;
}

let nextId = 0;

// Elegir una opción de una lista para vincularla (una causa a un riesgo, un control a una causa). Las opciones llegan ya filtradas (sin las que
// ya están vinculadas); el campo de texto acota la lista cuando es larga. No decide nada: avisa qué se eligió y quien lo usa llama a la API.
@Component({
  selector: 'app-link-picker',
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-ink-muted" [for]="id + '-filter'">{{ labelKey() | translate }}</label>
      <input [id]="id + '-filter'" type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="'COMPLIANCE.LINK.SEARCH' | translate"
        class="h-9 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20" />
      <select [id]="id + '-select'" [attr.aria-label]="labelKey() | translate" size="5" [ngModel]="selected()" (ngModelChange)="selected.set($event)"
        class="w-full rounded-control border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20">
        @for (item of visible(); track item.id) {
        <option [value]="item.id">{{ item.label }}</option>
        } @empty {
        <option disabled>{{ 'COMPLIANCE.LINK.NOTHING_TO_LINK' | translate }}</option>
        }
      </select>
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

  protected confirm(): void {
    const id = this.selected();
    if (id) this.picked.emit(id);
  }
}
