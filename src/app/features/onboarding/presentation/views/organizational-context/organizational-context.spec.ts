import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@core/domain/services/auth.service';
import { OnboardingDraftService } from '@features/onboarding/domain/services/onboarding-draft.service';
import { OnboardingService } from '@features/onboarding/domain/services/onboarding.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { OrganizationalContext } from '@features/onboarding/domain/models/organizational-context.models';
import { OrganizationalContextView } from './organizational-context';

const EMPTY_CONTEXT = { id: null, name: 'ACME', description: null } as unknown as OrganizationalContext;

// El campo de descripción usa `targetValue`: al escribir, el borrador del modelo se actualiza.
describe('OrganizationalContextView · el campo de texto', () => {
  let fixture: ComponentFixture<OrganizationalContextView>;

  beforeEach(() => {
    const drafts = jasmine.createSpyObj<OnboardingDraftService>('OnboardingDraftService', ['load', 'save', 'clear']);
    drafts.load.and.returnValue(null);
    TestBed.configureTestingModule({
      imports: [OrganizationalContextView],
      providers: [
        provideTranslateService({ fallbackLang: 'es' }),
        provideRouter([]),
        { provide: OnboardingService, useValue: { get: () => of(EMPTY_CONTEXT), save: () => of(EMPTY_CONTEXT) } },
        { provide: OnboardingDraftService, useValue: drafts },
        { provide: AuthService, useValue: { validate: () => of(true) } },
        { provide: SessionService, useValue: { user: () => ({ id: 'u1' }), onboarding: () => null } },
        { provide: CatalogService, useValue: { options: () => of([]), regulations: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(OrganizationalContextView);
    fixture.detectChanges();
  });

  it('updates the draft when the person types the description', () => {
    const area = (fixture.nativeElement as HTMLElement).querySelector('textarea#description') as HTMLTextAreaElement;
    area.value = 'Vendemos software contable';
    area.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.draft().description).toBe('Vendemos software contable');
  });
});

describe('OrganizationalContextView · carga con error', () => {
  function render(status: number): HTMLElement {
    TestBed.configureTestingModule({
      imports: [OrganizationalContextView],
      providers: [
        provideTranslateService({ fallbackLang: 'es' }),
        provideRouter([]),
        { provide: OnboardingService, useValue: { get: () => throwError(() => new HttpErrorResponse({ status })) } },
        { provide: OnboardingDraftService, useValue: jasmine.createSpyObj('OnboardingDraftService', ['load', 'save', 'clear']) },
        { provide: AuthService, useValue: { validate: () => of(true) } },
        { provide: SessionService, useValue: { user: () => ({ id: 'u1' }), onboarding: () => null } },
        { provide: CatalogService, useValue: { options: () => of([]), regulations: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(OrganizationalContextView);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the admin-only state without a retry button on a 403', () => {
    const el = render(403);
    expect(el.textContent).toContain('ONBOARDING.FORBIDDEN_TITLE');
    expect(el.querySelector('a[href="/"]')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('keeps the retry state for any other error', () => {
    const el = render(500);
    expect(el.textContent).toContain('ONBOARDING.LOAD_ERROR_TITLE');
    expect(el.querySelector('button')).not.toBeNull();
  });
});

describe('OrganizationalContextView · guardar por primera vez', () => {
  let fixture: ComponentFixture<OrganizationalContextView>;
  let router: Router;

  beforeEach(() => {
    const drafts = jasmine.createSpyObj<OnboardingDraftService>('OnboardingDraftService', ['load', 'save', 'clear']);
    drafts.load.and.returnValue(null);
    TestBed.configureTestingModule({
      imports: [OrganizationalContextView],
      providers: [
        provideTranslateService({ fallbackLang: 'es' }),
        provideRouter([]),
        { provide: OnboardingService, useValue: { get: () => of(EMPTY_CONTEXT), save: () => of(EMPTY_CONTEXT) } },
        { provide: OnboardingDraftService, useValue: drafts },
        { provide: AuthService, useValue: { validate: () => of(true) } },
        { provide: SessionService, useValue: { user: () => ({ id: 'u1' }), onboarding: () => null } },
        { provide: CatalogService, useValue: { options: () => of([]), regulations: () => of([]) } },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OrganizationalContextView);
    fixture.detectChanges();
    fixture.componentInstance.draft.set({
      description: 'Vendemos software contable',
      size: 'small',
      years_in_operation: null,
      industry: 'tech',
      business_model: 'b2b',
      incorporation_countries: ['CO'],
      client_countries: ['CO'],
      compliance_maturity: 'initial',
      regulation_codes: ['SOC2'],
    });
  });

  it('keeps the screen busy until the navigation ends', async () => {
    let finish!: (ok: boolean) => void;
    spyOn(router, 'navigateByUrl').and.returnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    fixture.componentInstance.save();
    expect(fixture.componentInstance.stage()).toBe('saving');
    finish(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.stage()).toBe('saving');
  });

  it('goes back to the form when the navigation is cancelled', async () => {
    spyOn(router, 'navigateByUrl').and.resolveTo(false);
    fixture.componentInstance.save();
    expect(fixture.componentInstance.stage()).toBe('saving');
    await fixture.whenStable();
    expect(fixture.componentInstance.stage()).toBe('form');
  });

  it('goes back to the form when the navigation fails', async () => {
    spyOn(router, 'navigateByUrl').and.rejectWith(new Error('nav'));
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.componentInstance.stage()).toBe('form');
  });
});
