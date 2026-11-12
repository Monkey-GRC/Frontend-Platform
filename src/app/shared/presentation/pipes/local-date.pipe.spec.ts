import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { LocalDatePipe } from './local-date.pipe';

describe('LocalDatePipe', () => {
  let pipe: LocalDatePipe;
  let language: LanguageService;
  const date = new Date(2026, 10, 9, 12);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: TranslateService, useValue: {} }] });
    language = TestBed.inject(LanguageService);
    pipe = TestBed.runInInjectionContext(() => new LocalDatePipe());
  });

  it('formatea en español', () => {
    language.current.set('es');
    expect(pipe.transform(date)).toBe('9 nov 2026');
  });

  it('formatea en inglés', () => {
    language.current.set('en');
    expect(pipe.transform(date)).toBe('Nov 9, 2026');
  });

  it('sigue el cambio de idioma', () => {
    language.current.set('en');
    const en = pipe.transform(date);
    language.current.set('es');
    expect(pipe.transform(date)).not.toBe(en);
  });

  it('acepta cadenas ISO y respeta dateStyle', () => {
    language.current.set('en');
    expect(pipe.transform(date.toISOString(), 'long')).toBe('November 9, 2026');
  });

  it('con withTime añade la hora en el formato del idioma', () => {
    language.current.set('en');
    expect(pipe.transform(date, 'medium', true)).toMatch(/^Nov 9, 2026.*12:00\s?PM$/);
    language.current.set('es');
    expect(pipe.transform(date, 'medium', true)).toMatch(/^9 nov 2026.*12:00$/);
  });

  it('devuelve cadena vacía con null, undefined, vacío o fecha inválida', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('no-fecha')).toBe('');
  });
});
