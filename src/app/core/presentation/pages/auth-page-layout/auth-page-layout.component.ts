import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeToggleTwoComponent } from '@core/presentation/components/theme-toggle-two/theme-toggle-two.component'
import { LanguageToggleComponent } from '@core/presentation/components/app-header/language-toggle/language-toggle.component';

@Component({
  selector: 'app-auth-page-layout',
  imports: [
    RouterModule,
    ThemeToggleTwoComponent,
    LanguageToggleComponent,
    TranslatePipe,
  ],
  templateUrl: './auth-page-layout.component.html',
  styles: ``
})
export class AuthPageLayoutComponent {

}
