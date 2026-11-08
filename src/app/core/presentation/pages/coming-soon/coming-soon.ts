import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';

// Pantalla provisional de una ruta cuya historia aún no se construye (D102, MD-196): «Mi trabajo» (MD-201) y la asignación de controles (MD-199, MD-200) esperan al Backend.
// La ruta trae su título e ícono en `data`; al construir la vista real, solo se cambia su `loadComponent`.
@Component({
  selector: 'app-coming-soon',
  imports: [EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-empty-state [icon]="icon()" [titleKey]="titleKey()" descriptionKey="SHELL.COMING_SOON" />`,
})
export class ComingSoonView {
  private readonly data = toSignal(inject(ActivatedRoute).data, { requireSync: true });

  readonly titleKey = computed(() => (this.data()['titleKey'] as string | undefined) ?? 'SHELL.NAV.HOME');
  readonly icon = computed(() => (this.data()['icon'] as string | undefined) ?? 'construction');
}
