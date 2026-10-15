import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';

// Contenido provisional de una pestaña mientras su historia no la construye (MD-120, MD-124, MD-129, MD-140).
// La ruta de cada pestaña trae su título e ícono en `data`; al construir la vista real, solo se cambia su `loadComponent`.
@Component({
  selector: 'app-compliance-section',
  imports: [EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-empty-state [icon]="icon()" [titleKey]="titleKey()" descriptionKey="COMPLIANCE.SHELL.COMING_SOON" />`,
})
export class ComplianceSectionView {
  private readonly data = toSignal(inject(ActivatedRoute).data, { requireSync: true });

  readonly titleKey = computed(() => (this.data()['titleKey'] as string | undefined) ?? 'COMPLIANCE.SHELL.TITLE');
  readonly icon = computed(() => (this.data()['icon'] as string | undefined) ?? 'inbox');
}
