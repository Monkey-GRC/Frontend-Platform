import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NavigationHistoryService } from '@core/domain/services/navigation-history.service';
import { SETTINGS_GROUPS } from '@features/settings/domain/models/settings-section';
import { SettingsShellView } from './settings-shell';

describe('SettingsShellView (pantalla completa de Ajustes)', () => {
  let fixture: ComponentFixture<SettingsShellView>;
  let returnUrl: string;

  beforeEach(() => {
    returnUrl = '/services/abc';
    TestBed.configureTestingModule({
      imports: [SettingsShellView],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: NavigationHistoryService, useValue: { get returnUrl() { return returnUrl; } } }],
    });
    fixture = TestBed.createComponent(SettingsShellView);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('is a full screen of its own: no app header, no app sidebar, no dialog', () => {
    expect(el().querySelector('app-header, app-sidebar, [role="dialog"]')).toBeNull();
  });

  it('goes back to the screen the person was on, not to the home', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    el().querySelector<HTMLButtonElement>('[data-testid="settings-back"]')!.click();
    expect(navigate).toHaveBeenCalledOnceWith('/services/abc');
  });

  it('lists every section, grouped, as a real link', () => {
    for (const group of SETTINGS_GROUPS) {
      for (const section of group.sections) {
        const link = el().querySelector<HTMLAnchorElement>(`[data-testid="settings-nav-${section.name}"]`)!;
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toContain(section.path);
      }
    }
    expect(el().querySelectorAll('p').length).toBeGreaterThanOrEqual(SETTINGS_GROUPS.length);
  });

  it('has an outlet where the chosen section is drawn', () => {
    expect(el().querySelector('router-outlet')).not.toBeNull();
  });
});
