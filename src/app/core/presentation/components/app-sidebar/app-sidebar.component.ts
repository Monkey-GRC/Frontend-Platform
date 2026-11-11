// app-sidebar.component.ts

import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { SidebarService } from '@core/domain/services/sidebar.service';
import { NavItem, NAV_ITEMS, NavSubItem, SECTION_LABEL_KEYS, NavigationHelper } from '@config/navigation.config';
import { filterNavByRole, groupDomId, groupHasActiveRoute, openActiveGroups, toggleGroup } from './sidebar-groups';

interface Flyout {
  name: string;
  top: number;
  left: number;
}

@Component({
  selector: 'app-sidebar',
  imports: [NgClass, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  readonly sidebarService = inject(SidebarService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  private readonly isExpanded = toSignal(this.sidebarService.isExpanded$, { requireSync: true });
  private readonly isHovered = toSignal(this.sidebarService.isHovered$, { requireSync: true });
  readonly isMobileOpen = toSignal(this.sidebarService.isMobileOpen$, { requireSync: true });

  /** Labels are visible when the menu is wide: expanded, hovered or open on a phone. */
  readonly showLabels = computed(() => this.isExpanded() || this.isHovered() || this.isMobileOpen());
  /** Collapsed (icons only) on a wide screen: the icons are centered. */
  readonly centerIcons = computed(() => !(this.isExpanded() || this.isHovered()));

  // Each person sees what their role can use; the children honor `roles` too. The real barrier is the backend.
  private readonly visibleItems = computed(() => filterNavByRole(NAV_ITEMS, this.session.user()?.role));
  get navItems(): NavItem[] {
    return this.visibleItems();
  }

  private readonly url = signal(this.router.url);
  /** Open groups. A session signal: it is not saved anywhere. */
  readonly openGroups = signal<ReadonlySet<string>>(new Set());
  readonly flyout = signal<Flyout | null>(null);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.url.set(this.router.url));
    // A parent opens by itself when its route or the one of a child is active (also once the session loads); it never closes by itself.
    effect(() => {
      const items = this.visibleItems();
      const url = this.url();
      untracked(() => this.openGroups.update((open) => openActiveGroups(open, items, (path) => this.matches(url, path))));
    });
  }

  get sections(): string[] {
    return NavigationHelper.getSections(this.navItems);
  }

  getItemsBySection(section: string): NavItem[] {
    return NavigationHelper.getItemsBySection(this.navItems, section);
  }

  sectionLabelKey(section: string): string {
    return SECTION_LABEL_KEYS[section] ?? section;
  }

  labelOf(entry: NavItem | NavSubItem): string {
    return entry.labelKey;
  }

  groupId(name: string): string {
    return groupDomId(name);
  }

  isActive(path?: string): boolean {
    return !!path && this.matches(this.url(), path);
  }

  private matches(currentUrl: string, path: string): boolean {
    const url = currentUrl.split(/[?#]/)[0];
    if (path === '/') return url === '/';
    return url === path || url.startsWith(path + '/');
  }

  /** The group holds the active page: its title is marked «contains the active section» (it is not an active item). */
  containsActive(item: NavItem): boolean {
    return groupHasActiveRoute(item, (path) => this.isActive(path));
  }

  isOpen(name: string): boolean {
    return this.openGroups().has(name);
  }

  toggleGroup(name: string): void {
    this.openGroups.update((open) => toggleGroup(open, name));
  }

  /** Flyout of a group while the menu is collapsed (icons only). `fixed` escapes the scroll container of the nav. */
  openFlyout(name: string, row: HTMLElement): void {
    if (this.showLabels()) return;
    const box = row.getBoundingClientRect();
    this.flyout.set({ name, top: box.top, left: box.right });
  }

  closeFlyout(): void {
    this.flyout.set(null);
  }

  onFocusOut(event: FocusEvent, row: HTMLElement): void {
    if (!row.contains(event.relatedTarget as Node | null)) this.closeFlyout();
  }

  onSidebarMouseEnter(): void {
    if (!this.isExpanded()) this.sidebarService.setHovered(true);
  }

  /** On a phone, choosing a destination closes the menu. */
  onNavigate(): void {
    this.closeFlyout();
    if (this.isMobileOpen()) this.sidebarService.setMobileOpen(false);
  }
}
