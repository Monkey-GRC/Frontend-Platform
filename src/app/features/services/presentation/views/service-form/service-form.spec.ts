import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@core/domain/services/auth.service';
import { RiskWizard } from '@shared/presentation/components/risk-wizard/risk-wizard';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Service } from '@shared/domain/models/service.models';
import { ServiceDraftService } from '@features/services/domain/services/service-draft.service';
import { ServiceService } from '@shared/domain/services/service.service';
import { ServiceFormView } from './service-form';

// El asistente de riesgos que sigue a un alta nuevo tiene sus propias pruebas: aquí solo se comprueba que se abre.
@Component({ selector: 'app-risk-wizard', template: '<p data-risk-wizard-stub></p>' })
class RiskWizardStub {
  readonly serviceId = input<string>();
  readonly finished = output<void>();
}

const FRAMEWORK = { code: 'soc2', name: 'SOC 2', description: '', label: 'SOC 2', availability: 'available' };
const OPTIONS = [
  { value: 'one', label: 'Uno', group: 'country' },
  { value: 'two', label: 'Dos', group: 'country' },
];
const SAVED = { id: 's1', name: 'Soporte', catalog: { applicable_requirements: 3, cloned_controls: 2 } } as unknown as Service;
const taken = () => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'SERVICE_NAME_TAKEN' } } });

// El asistente de alta de un servicio (D89): seis pasos y una revisión. Se prueba el camino principal (paso a paso, la validación de cada paso y el envío) y un error del servidor.
describe('ServiceFormView — declarar un servicio', () => {
  let fixture: ComponentFixture<ServiceFormView>;
  let form: ServiceFormView;
  let api: jasmine.SpyObj<ServiceService>;
  let drafts: jasmine.SpyObj<ServiceDraftService>;
  let auth: { validate: jasmine.Spy };

  function setup(): void {
    api = jasmine.createSpyObj<ServiceService>('ServiceService', ['get', 'create', 'update', 'uploadSystemDescription', 'systemDescriptionDownload']);
    api.create.and.returnValue(of(SAVED));
    drafts = jasmine.createSpyObj<ServiceDraftService>('ServiceDraftService', ['load', 'save', 'clear']);
    drafts.load.and.returnValue(null);
    auth = { validate: jasmine.createSpy('validate').and.returnValue(of(true)) };
    TestBed.configureTestingModule({
      imports: [ServiceFormView],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: ServiceService, useValue: api },
        { provide: ServiceDraftService, useValue: drafts },
        { provide: AuthService, useValue: auth },
        { provide: SessionService, useValue: { user: () => ({ id: 'u1' }), onboarding: () => ({ next_step: 'service' }) } },
        { provide: CatalogService, useValue: { options: () => of(OPTIONS), frameworks: () => of([FRAMEWORK]), contractedFrameworks: () => of([FRAMEWORK]) } },
      ],
    });
    TestBed.overrideComponent(ServiceFormView, { remove: { imports: [RiskWizard] }, add: { imports: [RiskWizardStub] } });
    fixture = TestBed.createComponent(ServiceFormView);
    form = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const render = () => fixture.detectChanges();

  // Contesta lo que pide cada paso, por las mismas acciones que usan los campos de la pantalla.
  const answer = (step: number) => {
    if (step === 0) {
      form.setText('name', '  Soporte  ');
      form.setText('description', 'Atención de primer nivel');
      form.setText('scope_statement', 'Todo el servicio');
    } else if (step === 1) {
      form.pick('type', 'one');
      form.toggle('industries_served', 'one');
    } else if (step === 2) {
      form.toggle('countries', 'one');
      form.toggle('data_types', 'one');
      form.pick('expected_availability', 'one');
    } else if (step === 3) {
      form.toggleFullCoverage();
    } else if (step === 4) {
      form.toggleSubservice('one');
    } else if (step === 5) {
      form.setUrl('https://acme.co/sistema');
    }
    render();
  };
  const walkToReview = () => {
    for (let step = 0; step < 6; step++) {
      answer(step);
      form.next();
      render();
    }
  };

  it('loads the catalogs and opens on the first step, with the only contracted framework already chosen', () => {
    setup();
    expect(form.stage()).toBe('form');
    expect(form.step()).toBe(0);
    expect(form.draft().framework_codes).toEqual(['soc2']);
    expect(el().querySelector('input#name')).not.toBeNull();
    expect(el().querySelector('[data-service-rail]')).not.toBeNull();
  });

  it('centers the narrow stages (result) in the content panel and keeps the wizard full width', () => {
    setup();
    const section = () => el().querySelector('section') as HTMLElement;
    expect(section().classList.contains('max-w-3xl')).toBe(false);
    form.stage.set('done');
    render();
    expect(section().classList.contains('max-w-3xl')).toBe(true);
    expect(section().classList.contains('mx-auto')).toBe(true);
    expect(el().querySelector('[data-service-done]')).not.toBeNull();
  });

  it('updates the draft when the person types in the name field', () => {
    setup();
    const input = el().querySelector('input#name') as HTMLInputElement;
    input.value = 'Facturación';
    input.dispatchEvent(new Event('input'));
    expect(form.draft().name).toBe('Facturación');
  });

  it('does not move on until the step is answered, and then says what is missing', () => {
    setup();
    form.next();
    render();
    expect(form.step()).toBe(0);
    expect(form.showHints()).toBeTrue();
    expect(el().textContent).toContain('SERVICES.FORM.NAME_HINT');
    answer(0);
    form.next();
    render();
    expect(form.step()).toBe(1);
    expect(form.showHints()).toBeFalse();
  });

  it('goes back keeping what was answered', () => {
    setup();
    answer(0);
    form.next();
    form.back();
    render();
    expect(form.step()).toBe(0);
    expect(form.draft().description).toBe('Atención de primer nivel');
    expect((el().querySelector('input#name') as HTMLInputElement).value).toBe('  Soporte  ');
  });

  it('asks before leaving the framework step with only part of the categories, and keeps that choice once confirmed', () => {
    setup();
    for (let step = 0; step < 3; step++) {
      answer(step);
      form.next();
    }
    expect(form.step()).toBe(3);
    form.next(); // solo seguridad: falta cubrir el resto
    render();
    expect(form.coverageWarning()).toBeTrue();
    expect(form.step()).toBe(3);
    form.keepPartialCoverage();
    expect(form.step()).toBe(4);
  });

  it('walks the six steps to the review and sends the cleaned answers once', () => {
    setup();
    walkToReview();
    expect(form.step()).toBe(form.reviewStep);
    expect(form.allValid()).toBeTrue();
    form.save();
    render();
    expect(api.create).toHaveBeenCalledTimes(1);
    const sent = api.create.calls.mostRecent().args[0];
    expect(sent.name).toBe('Soporte');
    expect(sent.framework_codes).toEqual(['soc2']);
    expect(sent.subservice_organizations.map((s) => s.type)).toEqual(['one']);
    expect(sent.system_description).toEqual({ kind: 'link', url: 'https://acme.co/sistema' });
    expect(drafts.clear).toHaveBeenCalledWith('u1');
    expect(auth.validate).toHaveBeenCalled();
    // Un servicio nuevo sigue con la evaluación de sus riesgos en la misma pantalla.
    expect(form.stage()).toBe('risks');
    expect(el().querySelector('[data-risk-wizard-stub]')).not.toBeNull();
  });

  it('does not send anything while a step is still unanswered', () => {
    setup();
    answer(0);
    form.save();
    expect(api.create).not.toHaveBeenCalled();
    expect(form.showHints()).toBeTrue();
  });

  it('goes back to the first step with a clear message when the server says the name is taken, and keeps the draft', () => {
    setup();
    walkToReview();
    api.create.and.returnValue(throwError(taken));
    form.save();
    render();
    expect(form.stage()).toBe('form');
    expect(form.step()).toBe(0);
    expect(form.saveError()).toBe('SERVICES.FORM.NAME_TAKEN');
    expect(drafts.clear).not.toHaveBeenCalled();
    expect(form.draft().name).toBe('  Soporte  ');
    expect(auth.validate).not.toHaveBeenCalled();
  });
});
