// app-sidebar.component.ts

import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { SidebarService } from '@core/domain/services/sidebar.service';
import { NavItem, NAV_ITEMS, SECTION_ICONS, NavigationHelper, NavSubItem } from '@config/navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {

  // Importar la configuración desde el archivo externo
  navItems: NavItem[] = NAV_ITEMS;
  sectionIcons = SECTION_ICONS;

  openSubmenu: string | null = null;
  subMenuHeights: { [key: string]: number } = {};
  @ViewChildren('subMenu') subMenuRefs!: QueryList<ElementRef>;

  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription: Subscription = new Subscription();

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    // Subscribe to router events
    this.subscription.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.setActiveMenuFromRoute(this.router.url);
        }
      })
    );

    // Subscribe to combined observables
    this.subscription.add(
      combineLatest([this.isExpanded$, this.isMobileOpen$, this.isHovered$]).subscribe(
        ([isExpanded, isMobileOpen, isHovered]) => {
          if (!isExpanded && !isMobileOpen && !isHovered) {
            this.cdr.detectChanges();
          }
        }
      )
    );

    // Initial load
    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // Usar helpers para obtener secciones
  get sections(): string[] {
    return NavigationHelper.getSections(this.navItems);
  }

  // Obtener items por sección
  getItemsBySection(section: string): NavItem[] {
    return NavigationHelper.getItemsBySection(this.navItems, section);
  }

  // Obtener icono para sección cuando está colapsada
  getSectionIcon(section: string): string {
    return NavigationHelper.getSectionIcon(section, this.sectionIcons);
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  toggleSubmenu(itemName: string) {
    if (this.openSubmenu === itemName) {
      this.openSubmenu = null;
      this.subMenuHeights[itemName] = 0;
    } else {
      this.openSubmenu = itemName;

      setTimeout(() => {
        const el = document.getElementById(itemName);
        if (el) {
          this.subMenuHeights[itemName] = el.scrollHeight;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe(expanded => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    this.navItems.forEach((item) => {
      if (item.subItems) {
        item.subItems.forEach((subItem: NavSubItem) => {
          if (currentUrl === subItem.path) {
            this.openSubmenu = item.name;

            setTimeout(() => {
              const el = document.getElementById(item.name);
              if (el) {
                this.subMenuHeights[item.name] = el.scrollHeight;
                this.cdr.detectChanges();
              }
            });
          }
        });
      }
    });
  }

  onSubmenuClick() {
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }
}