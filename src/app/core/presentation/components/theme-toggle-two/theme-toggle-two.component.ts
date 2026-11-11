import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from '@core/domain/services/theme.service';

// Theme button of the auth shell (markup canonical, in design-system).
@Component({
  selector: 'app-theme-toggle-two',
  imports: [TranslatePipe],
  templateUrl: './theme-toggle-two.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleTwoComponent {
  private readonly themeService = inject(ThemeService);

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
