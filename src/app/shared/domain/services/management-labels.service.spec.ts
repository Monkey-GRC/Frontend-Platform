import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, defer, of, throwError } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { LABELS_RETRY_DELAY_MS, ManagementLabelsService } from './management-labels.service';

describe('ManagementLabelsService', () => {
  const retryDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

  it('asks the backend for the lists and falls back to the value while a label is missing', () => {
    const options = jasmine.createSpy('options').and.callFake((name: string) => of(name === 'control_management_state' ? [{ value: 'approved', label: 'Cumplimiento aprobado' }] : [{ value: 'correct', label: 'Correcto' }]));
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    TestBed.tick();
    expect(options).toHaveBeenCalledWith('control_management_state');
    expect(options).toHaveBeenCalledWith('control_level');
    expect(service.state('approved')).toBe('Cumplimiento aprobado');
    expect(service.state('returned')).toBe('returned');
    expect(service.label('control_level', null)).toBe('—');
    expect(service.results()[0].value).toBe('correct');
  });

  it('retries a failed catalog once and keeps working when it fails again', async () => {
    let subscriptions = 0;
    const options = (name: string) => (name === 'control_level' ? defer(() => (++subscriptions, throwError(() => new Error('x')))) : of([{ value: 'approved', label: 'Aprobado' }]));
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    TestBed.tick();
    await retryDelay();
    expect(subscriptions).toBe(2);
    expect(service.state('approved')).toBe('Aprobado');
    expect(service.label('control_level', 'weak')).toBe('weak');
  });

  it('recovers when the retry works', async () => {
    let tries = 0;
    const options = (name: string) => (name === 'control_level' ? defer(() => (++tries === 1 ? throwError(() => new Error('x')) : of([{ value: 'weak', label: 'Débil' }]))) : of([]));
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    TestBed.tick();
    await retryDelay();
    expect(service.label('control_level', 'weak')).toBe('Débil');
  });

  it('does not overwrite an already loaded catalog with an empty one when a later load fails', async () => {
    let fail = false;
    const options = () => (fail ? throwError(() => new Error('x')) : of([{ value: 'approved', label: 'Aprobado' }]));
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    TestBed.tick();
    expect(service.state('approved')).toBe('Aprobado');
    fail = true;
    TestBed.inject(LanguageService).current.set('en');
    TestBed.tick();
    await retryDelay();
    expect(service.state('approved')).toBe('Aprobado');
  });

  it('drops the answer of the previous language when the language changes while it is still loading', () => {
    const slow = new Subject<CatalogOption[]>();
    let call = 0;
    const options = jasmine.createSpy('options').and.callFake((name: string) => {
      if (name !== 'control_management_state') return of([]);
      return ++call === 1 ? slow : of([{ value: 'approved', label: 'Approved' }]);
    });
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    TestBed.tick();
    TestBed.inject(LanguageService).current.set('en');
    TestBed.tick();
    slow.next([{ value: 'approved', label: 'Aprobado' }]);
    slow.complete();
    expect(service.state('approved')).toBe('Approved');
  });

  it('reports loading, ready and failed per catalog', async () => {
    const slow = new Subject<CatalogOption[]>();
    const options = (name: string) => (name === 'control_level' ? defer(() => throwError(() => new Error('x'))) : name === 'manual_test_result_value' ? slow : of([{ value: 'a', label: 'A' }]));
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: CatalogService, useValue: { options } }] });
    const service = TestBed.inject(ManagementLabelsService);
    expect(service.status('control_level')).toBe('loading');
    TestBed.tick();
    expect(service.status('manual_test_result_value')).toBe('loading');
    expect(service.status('control_management_state')).toBe('ready');
    await retryDelay();
    expect(service.status('control_level')).toBe('failed');
    slow.next([{ value: 'correct', label: 'Correcto' }]);
    slow.complete();
    expect(service.status('manual_test_result_value')).toBe('ready');
  });
});
