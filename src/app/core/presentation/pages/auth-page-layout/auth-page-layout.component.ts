import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { ThemeToggleTwoComponent } from '@core/presentation/components/theme-toggle-two/theme-toggle-two.component';

// Auth shell: the markup is canonical (design-system); this file only differs from the other app in the service alias.
@Component({
  selector: 'app-auth-page-layout',
  imports: [RouterModule, ThemeToggleTwoComponent, TranslatePipe],
  templateUrl: './auth-page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageLayoutComponent {
  private readonly language = inject(LanguageService);

  protected readonly languageCode = computed(() => this.language.current().toUpperCase());

  protected toggleLanguage(): void {
    this.language.set(this.language.current() === 'es' ? 'en' : 'es');
  }
}
