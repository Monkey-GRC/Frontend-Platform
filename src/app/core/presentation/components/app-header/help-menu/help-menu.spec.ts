import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { HelpMenu } from './help-menu';

describe('HelpMenu (el «?» del encabezado)', () => {
  let fixture: ComponentFixture<HelpMenu>;
  const env = environment as { supportUrl?: string };
  const original = env.supportUrl;

  function setup(supportUrl: string | undefined): void {
    env.supportUrl = supportUrl;
    TestBed.configureTestingModule({ imports: [HelpMenu], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(HelpMenu);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(testId: string) => el().querySelector<T>(`[data-testid="${testId}"]`);
  const openMenu = () => {
    q('help-trigger')!.click();
    fixture.detectChanges();
  };

  afterEach(() => (env.supportUrl = original));

  it('stays closed until the icon is clicked, then lists the keyboard shortcuts', () => {
    setup(undefined);
    expect(q('help-panel')).toBeNull();
    openMenu();
    expect(q('help-trigger')!.getAttribute('aria-expanded')).toBe('true');
    const shortcuts = q('help-shortcuts')!.textContent!;
    expect(shortcuts).toContain('K');
    expect(shortcuts).toContain('Esc');
  });

  it('does not offer to contact support when the environment has no support address', () => {
    setup(undefined);
    openMenu();
    expect(q('help-support')).toBeNull();
  });

  it('treats a blank support address as none', () => {
    setup('   ');
    openMenu();
    expect(q('help-support')).toBeNull();
  });

  it('offers a web support page in a new tab, safely', () => {
    setup('https://soporte.ejemplo.com');
    openMenu();
    const link = q<HTMLAnchorElement>('help-support')!;
    expect(link.getAttribute('href')).toBe('https://soporte.ejemplo.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('offers a mailto: support address without opening a new tab', () => {
    setup('mailto:soporte@ejemplo.com');
    openMenu();
    const link = q<HTMLAnchorElement>('help-support')!;
    expect(link.getAttribute('href')).toBe('mailto:soporte@ejemplo.com');
    expect(link.getAttribute('target')).toBeNull();
  });

  it('closes with Escape and with a click outside, but not with a click inside', () => {
    setup(undefined);
    openMenu();
    q('help-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(q('help-panel')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('help-panel')).toBeNull();
    openMenu();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(q('help-panel')).toBeNull();
  });
});
