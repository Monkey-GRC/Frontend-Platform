import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { ThemeService } from '@core/domain/services/theme.service';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { ProfileMenu } from './profile-menu';

describe('ProfileMenu (perfil, idioma, modo oscuro, ajustes y salir)', () => {
  let fixture: ComponentFixture<ProfileMenu>;
  let auth: jasmine.SpyObj<AuthService>;
  let language: { current: ReturnType<typeof import('@angular/core').signal<'es' | 'en'>>; set: jasmine.Spy };
  let theme: ThemeService;

  async function setup(user: { name: string | null; last_name: string | null; email: string } | null = { name: 'Héctor', last_name: 'Ríos', email: 'hector@empresa.com' }) {
    const { signal } = await import('@angular/core');
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    auth.logout.and.returnValue(of(void 0));
    language = { current: signal<'es' | 'en'>('es'), set: jasmine.createSpy('set') };
    TestBed.configureTestingModule({
      imports: [ProfileMenu],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: AuthService, useValue: auth }, { provide: LanguageService, useValue: language }],
    });
    if (user) TestBed.inject(SessionService).set({ id: 'u1', role: 'admin_empresa', ...user }, { id: 'c', name: 'ACME' });
    theme = TestBed.inject(ThemeService);
    theme.setTheme('light');
    fixture = TestBed.createComponent(ProfileMenu);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(testId: string) => el().querySelector<T>(`[data-testid="${testId}"]`);
  const openMenu = () => {
    q('profile-trigger')!.click();
    fixture.detectChanges();
  };

  afterEach(() => localStorage.removeItem('theme'));

  it('shows the initials circle and nothing else until it is opened', async () => {
    await setup();
    expect(q('profile-trigger')!.textContent).toContain('HR');
    expect(q('profile-panel')).toBeNull();
  });

  it('shows nothing without a session', async () => {
    await setup(null);
    expect(q('profile-trigger')).toBeNull();
  });

  it('opens with the name and the email, and falls back to the email when the person has no name', async () => {
    await setup();
    openMenu();
    expect(q('profile-name')!.textContent).toContain('Héctor Ríos');
    expect(q('profile-email')!.textContent).toContain('hector@empresa.com');
    expect(q('profile-trigger')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses the email for the name and the initials when the account has no name', async () => {
    await setup({ name: null, last_name: null, email: 'ana.perez@empresa.com' });
    expect(q('profile-trigger')!.textContent).toContain('AP');
    openMenu();
    expect(q('profile-name')!.textContent).toContain('ana.perez@empresa.com');
  });

  it('links to the Settings page with a real URL (so it can open in a new tab) and closes the menu', async () => {
    await setup();
    openMenu();
    const link = q<HTMLAnchorElement>('profile-settings')!;
    expect(link.getAttribute('href')).toBe('/ajustes');
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    fixture.detectChanges();
    expect(q('profile-panel')).toBeNull();
  });

  it('changes the language from inside the menu and marks the current one', async () => {
    await setup();
    openMenu();
    expect(q('profile-lang-es')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('profile-lang-en')!.getAttribute('aria-pressed')).toBe('false');
    q('profile-lang-en')!.click();
    expect(language.set).toHaveBeenCalledOnceWith('en');
  });

  it('turns dark mode on and off with a switch that reflects the state', async () => {
    await setup();
    openMenu();
    const sw = q('profile-dark')!;
    expect(sw.getAttribute('role')).toBe('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.click();
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(q('profile-dark')!.getAttribute('aria-checked')).toBe('true');
    q('profile-dark')!.click();
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('closes with Escape and with a click outside, but not with a click inside', async () => {
    await setup();
    openMenu();
    q('profile-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(q('profile-panel')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('profile-panel')).toBeNull();
    openMenu();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(q('profile-panel')).toBeNull();
  });

  it('signs out and goes to the sign-in screen', async () => {
    await setup();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    openMenu();
    q('profile-logout')!.click();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/signin', { replaceUrl: true });
  });
});
