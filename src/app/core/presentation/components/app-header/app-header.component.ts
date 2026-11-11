import { Component, inject, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HelpMenu } from '@core/presentation/components/app-header/help-menu/help-menu';
import { ProfileMenu } from '@core/presentation/components/app-header/profile-menu/profile-menu';
import { SidebarService } from '@core/domain/services/sidebar.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HelpMenu,
    ProfileMenu,
    TranslatePipe
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent implements AfterViewInit, OnDestroy {
  readonly sidebarService = inject(SidebarService);
  isApplicationMenuOpen = false;
  readonly isMobileOpen$ = this.sidebarService.isMobileOpen$;

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  handleToggle() {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  toggleApplicationMenu() {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }

  ngAfterViewInit() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  };
}
