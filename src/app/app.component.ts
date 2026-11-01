import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavigationProgress } from '@core/presentation/components/navigation-progress/navigation-progress';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    NavigationProgress,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Monkey GRC';
}
