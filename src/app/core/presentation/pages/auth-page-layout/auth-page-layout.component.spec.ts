import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { LanguageService } from '@core/domain/services/language.service';
import { ThemeService } from '@core/domain/services/theme.service';
import { AuthPageLayoutComponent } from './auth-page-layout.component';

@Component({
  imports: [AuthPageLayoutComponent],
  template: '<app-auth-page-layout><p data-testid="projected">form</p></app-auth-page-layout>',
})
class HostComponent {}

describe('AuthPageLayoutComponent (shared auth shell)', () => {
  function setup(lang: 'es' | 'en' = 'es') {
    const language = { current: signal<'es' | 'en'>(lang), set: jasmine.createSpy('set') };
    const theme = { theme$: { subscribe: () => ({ unsubscribe: () => undefined }) }, toggleTheme: jasmine.createSpy('toggleTheme') };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: LanguageService, useValue: language }, { provide: ThemeService, useValue: theme }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { language, theme, el: fixture.nativeElement as HTMLElement, fixture };
  }

  it('renders the projected content and the brand panel with its tagline', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="projected"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="auth-brand-panel"]')?.classList).toContain('bg-primary-500');
    expect(el.querySelector('[data-testid="auth-tagline"]')?.textContent).toContain('AUTH.LAYOUT.TAGLINE');
  });

  it('has the language and theme buttons, language first (above), both with an aria-label', () => {
    const { el } = setup();
    const buttons = Array.from(el.querySelectorAll('[data-testid="auth-controls"] button'));
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['auth-language', 'auth-theme']);
    buttons.forEach((b) => expect(b.getAttribute('aria-label')).toBeTruthy());
    expect(buttons[0].textContent?.trim()).toBe('ES');
  });

  it('switches the language through the shared LanguageService', () => {
    const { el, language } = setup('es');
    (el.querySelector('[data-testid="auth-language"]') as HTMLButtonElement).click();
    expect(language.set).toHaveBeenCalledOnceWith('en');
  });

  it('switches back to Spanish from English', () => {
    const { el, language } = setup('en');
    (el.querySelector('[data-testid="auth-language"]') as HTMLButtonElement).click();
    expect(language.set).toHaveBeenCalledOnceWith('es');
  });

  it('toggles the theme through the ThemeService', () => {
    const { el, theme } = setup();
    (el.querySelector('[data-testid="auth-theme"]') as HTMLButtonElement).click();
    expect(theme.toggleTheme).toHaveBeenCalled();
  });
});
