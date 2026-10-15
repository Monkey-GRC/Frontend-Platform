import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { EnumLabelService } from './enum-label.service';

describe('EnumLabelService', () => {
  let labels: EnumLabelService;
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ fallbackLang: 'es' })] });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { X: { LEVEL: { HIGH: 'Alto' } } });
    translate.use('es');
    labels = TestBed.inject(EnumLabelService);
  });

  it('finds the text of a value by its upper-case key', () => {
    expect(labels.of('X.LEVEL', 'high')).toBe('Alto');
  });

  it('shows a value it has no text for as it arrived, never the key', () => {
    expect(labels.of('X.LEVEL', 'brand_new')).toBe('brand_new');
  });

  it('shows a dash when there is no value', () => {
    expect(labels.of('X.LEVEL', null)).toBe('—');
    expect(labels.of('X.LEVEL', undefined)).toBe('—');
  });
});
