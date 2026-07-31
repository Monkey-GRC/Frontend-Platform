import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  imports: [],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoaderComponent {

  @Input() text: string = 'Cargando...';
  @Input() type: 'monkey' | 'dashboard' = 'monkey';

  cards = [1, 2, 3, 4];
  rows = [1, 2, 3, 4, 5];

}
