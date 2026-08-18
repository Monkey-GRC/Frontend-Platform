import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-not-found-layout',
  imports: [],
  templateUrl: './not-found-layout.html',
  styleUrl: './not-found-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundLayout {

  currentYear: number = new Date().getFullYear();

}
