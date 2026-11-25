import { Component, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { HEADER_WIDGETS } from '@core/presentation/components/app-header/header-widgets';
import { SidebarService } from '@core/domain/services/sidebar.service';
import { AppHeaderComponent } from './app-header.component';

// The button that fixes the menu open (design system, «Shell flotante»): a pin, outline and muted when released, filled and in the action colour when fixed.
describe('AppHeaderComponent · pin of the side menu', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [AppHeaderComponent], providers: [provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const pin = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-sidebar-pin]')!;
    return { fixture, pin, sidebar: TestBed.inject(SidebarService) };
  }

  it('is a pin, pressed and in the action colour, filled, while the menu is fixed open', () => {
    const { pin } = setup();
    const icon = pin().querySelector<HTMLElement>('.material-symbols-rounded')!;
    expect(icon.textContent).toBe('push_pin');
    expect(pin().getAttribute('aria-pressed')).toBe('true');
    expect(pin().getAttribute('aria-label')).toBe('SHELL.NAV.UNPIN');
    expect(icon.className).toContain('text-action');
    expect(icon.className).not.toContain('text-ink-muted');
    expect(icon.style.fontVariationSettings).toContain('"FILL" 1');
  });

  it('turns outline and muted when the menu is released, and back when fixed again (the same toggle as before)', () => {
    const { fixture, pin, sidebar } = setup();
    const wide = spyOnProperty(window, 'innerWidth').and.returnValue(1440);
    pin().click();
    fixture.detectChanges();
    expect(wide).toHaveBeenCalled();
    let icon = pin().querySelector<HTMLElement>('.material-symbols-rounded')!;
    expect(pin().getAttribute('aria-pressed')).toBe('false');
    expect(pin().getAttribute('aria-label')).toBe('SHELL.NAV.PIN');
    expect(icon.className).toContain('text-ink-muted');
    expect(icon.className).not.toContain('text-action');
    expect(icon.style.fontVariationSettings).toContain('"FILL" 0');
    pin().click();
    fixture.detectChanges();
    icon = pin().querySelector<HTMLElement>('.material-symbols-rounded')!;
    expect(pin().getAttribute('aria-pressed')).toBe('true');
    expect(icon.className).toContain('text-action');
    sidebar.setMobileOpen(false);
  });

  it('shows the pin only on wide screens; below them the menu button still opens the drawer', () => {
    const { fixture, pin, sidebar } = setup();
    expect(pin().className).toContain('hidden');
    expect(pin().className).toContain('xl:flex');
    const menuButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="SHELL.NAV.TOGGLE_SIDEBAR"]')!;
    expect(menuButton.className).toContain('xl:hidden');
    spyOnProperty(window, 'innerWidth').and.returnValue(800);
    menuButton.click();
    fixture.detectChanges();
    let open = false;
    sidebar.isMobileOpen$.subscribe((v) => (open = v)).unsubscribe();
    expect(open).toBeTrue();
  });
});

// What other layers ask to show in the header (the bell of the notices) arrives by the `HEADER_WIDGETS` token: `core/` never imports a feature.
@Component({ selector: 'app-test-widget', template: '<span data-test-widget>widget</span>' })
class TestWidget {}

@Component({ selector: 'app-other-widget', template: '<span data-other-widget>other</span>' })
class OtherWidget {}

describe('AppHeaderComponent · widgets of other layers', () => {
  function create(providers: Provider[]) {
    TestBed.configureTestingModule({ imports: [AppHeaderComponent], providers: [provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting(), ...providers] });
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each provided widget before the help menu', () => {
    const host = create([{ provide: HEADER_WIDGETS, useValue: TestWidget, multi: true }]);
    const widget = host.querySelector('[data-test-widget]')!;
    expect(widget).not.toBeNull();
    expect(widget.compareDocumentPosition(host.querySelector('app-help-menu')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds a second provided widget after the first instead of replacing it (multi token)', () => {
    const host = create([
      { provide: HEADER_WIDGETS, useValue: TestWidget, multi: true },
      { provide: HEADER_WIDGETS, useValue: OtherWidget, multi: true },
    ]);
    const first = host.querySelector('[data-test-widget]')!;
    const second = host.querySelector('[data-other-widget]')!;
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows nothing extra when nobody provides one', () => {
    expect(create([]).querySelector('[data-test-widget]')).toBeNull();
  });
});
