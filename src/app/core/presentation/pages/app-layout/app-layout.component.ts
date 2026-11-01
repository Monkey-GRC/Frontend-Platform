import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavigationHistoryService } from '@core/domain/services/navigation-history.service';
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
  constructor(public sidebarService: SidebarService) {
    // Empieza a recordar en qué pantalla está la persona, para que «Volver a la aplicación» de Ajustes sepa a dónde volver.
    inject(NavigationHistoryService);
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
