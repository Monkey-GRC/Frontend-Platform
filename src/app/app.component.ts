import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastContainer } from '@shared/presentation/components/toast-container/toast-container';
import { LanguageService } from '@core/domain/services/language.service';
import { LanguageSwitching } from '@shared/presentation/components/language-switching/language-switching';
import { NavigationProgress } from '@core/presentation/components/navigation-progress/navigation-progress';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    NavigationProgress,
    ToastContainer,
    LanguageSwitching,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Monkey GRC';

  protected readonly language = inject(LanguageService);
}
