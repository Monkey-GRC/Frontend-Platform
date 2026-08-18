import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface CreateEntityPayload {
  name: string;
  impact?: number;
  probability?: number;
}

@Component({
  selector: 'app-entity-combobox',
  imports: [FormsModule],
  templateUrl: './entity-combobox.html',
  styleUrl: './entity-combobox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityCombobox {
  @Input({ required: true }) placeholder = '';
  @Input({ required: true }) pool: ComboboxOption[] = [];
  /** El riesgo necesita impacto/probabilidad al crearse; causas y controles no. */
  @Input() needsRiskFields = false;
  @Input() disabled = false;
  @Input() creatingLabel = 'Creando…';
  @Input() busy = false;

  @Output() link = new EventEmitter<string>();
  @Output() createNew = new EventEmitter<CreateEntityPayload>();

  readonly query = signal('');
  readonly open = signal(false);
  readonly creating = signal(false);
  readonly impact = signal(3);
  readonly probability = signal(3);

  readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    const list = term ? this.pool.filter((item) => item.label.toLowerCase().includes(term)) : this.pool;
    return list.slice(0, 6);
  });

  readonly exactMatch = computed(() =>
    this.pool.some((item) => item.label.toLowerCase() === this.query().trim().toLowerCase()),
  );

  onFocus(): void {
    this.open.set(true);
  }

  onBlur(): void {
    // pequeño delay para que el click en un item de la lista alcance a registrarse
    setTimeout(() => this.open.set(false), 150);
  }

  pick(option: ComboboxOption): void {
    this.link.emit(option.id);
    this.reset();
  }

  startCreate(): void {
    this.creating.set(true);
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.impact.set(3);
    this.probability.set(3);
  }

  confirmCreate(): void {
    const name = this.query().trim();
    if (!name) return;
    this.createNew.emit({
      name,
      impact: this.needsRiskFields ? this.impact() : undefined,
      probability: this.needsRiskFields ? this.probability() : undefined,
    });
    this.reset();
  }

  private reset(): void {
    this.query.set('');
    this.open.set(false);
    this.creating.set(false);
    this.impact.set(3);
    this.probability.set(3);
  }
}
