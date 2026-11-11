import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
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
