import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found-layout',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './not-found-layout.html',
  styleUrl: './not-found-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundLayout {

  currentYear: number = new Date().getFullYear();

}
