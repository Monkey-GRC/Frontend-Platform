import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterModule } from '@angular/router';
import { SidebarService } from '@core/domain/services/sidebar.service';
import { AppHeaderComponent } from '@core/presentation/components/app-header/app-header.component';
import { AppSidebarComponent } from '@core/presentation/components/app-sidebar/app-sidebar.component';
import { BackdropComponent } from '../../components/backdrop/backdrop.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    AppSidebarComponent,
    BackdropComponent
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent {
  readonly isExpanded$;
  readonly isHovered$;
  readonly isMobileOpen$;
  // Una navegación puede tardar (un guard que pregunta al servidor, un módulo que se descarga): mientras tanto se muestra una barra fina arriba, para que se vea que el clic funcionó.
  readonly navigating = signal(false);

  constructor(public sidebarService: SidebarService) {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.navigating.set(true);
        else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) this.navigating.set(false);
      });
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isHovered$ = this.sidebarService.isHovered$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded$ || this.isHovered$) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen$ ? 'ml-0' : ''
    ];
  }

}
