import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of } from 'rxjs';
import { LANGUAGE_RELOAD_DELAY_MS, LanguageService, RELOAD_PAGE, SAVE_LANGUAGE, storedLanguage } from './language.service';

describe('LanguageService', () => {
  let reload: jasmine.Spy;
  let translate: jasmine.SpyObj<TranslateService>;
  let save: jasmine.Spy<(lang: string) => Observable<void> | null>;

  function setup(saveResult: () => Observable<void> | null = () => null) {
    save = jasmine.createSpy('save').and.callFake(saveResult);
    reload = jasmine.createSpy('reload');
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['use', 'addLangs', 'setFallbackLang', 'instant']);
    translate.use.and.callFake(() => of({}));
    translate.instant.and.callFake(((key: string) => (key === 'COMMON.LANGUAGE_SWITCHING' ? 'Switching language…' : key)) as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: translate },
        { provide: RELOAD_PAGE, useValue: reload },
        { provide: SAVE_LANGUAGE, useValue: save },
      ],
    });
    return TestBed.inject(LanguageService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('starts in Spanish when nothing is saved, or the saved value is unknown', () => {
    expect(storedLanguage()).toBe('es');
    localStorage.setItem('lang', 'fr');
    expect(storedLanguage()).toBe('es');
    expect(setup().current()).toBe('es');
  });

  it('init applies the saved language (fallback es) and sets the html lang', () => {
    localStorage.setItem('lang', 'en');
    const service = setup();
    service.init().subscribe();
    expect(translate.setFallbackLang).toHaveBeenCalledWith('es');
    expect(translate.use).toHaveBeenCalledWith('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('init without a saved language uses es', () => {
    setup().init().subscribe();
    expect(translate.use).toHaveBeenCalledWith('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('set saves the preference, shows the loading layer in the target language and reloads', fakeAsync(() => {
    const service = setup();
    service.set('en');
    expect(localStorage.getItem('lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(service.switchingMessage()).toBe('Switching language…');
    expect(reload).not.toHaveBeenCalled();
    tick(LANGUAGE_RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  }));

  it('set to the current language does nothing', fakeAsync(() => {
    const service = setup();
    service.set('es');
    tick(1000);
    expect(service.switchingMessage()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  }));

  it('with a session it saves the language on the server before reloading', fakeAsync(() => {
    const done = new Subject<void>();
    const service = setup(() => done);
    service.set('en');
    tick(LANGUAGE_RELOAD_DELAY_MS);
    expect(save).toHaveBeenCalledOnceWith('en');
    expect(reload).not.toHaveBeenCalled();
    done.next();
    done.complete();
    expect(reload).toHaveBeenCalledTimes(1);
  }));

  it('reloads even if saving the language fails', fakeAsync(() => {
    const service = setup(() => new Observable<void>((o) => o.error(new Error('500'))));
    service.set('en');
    tick(LANGUAGE_RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  }));

  it('without a session (nothing to save) it just reloads', fakeAsync(() => {
    const service = setup(() => null);
    service.set('en');
    tick(LANGUAGE_RELOAD_DELAY_MS);
    expect(save).toHaveBeenCalledOnceWith('en');
    expect(reload).toHaveBeenCalledTimes(1);
  }));

  it('adopting the account language never calls the server', fakeAsync(() => {
    const service = setup(() => of(void 0));
    service.adoptAccountLanguage('en');
    tick(LANGUAGE_RELOAD_DELAY_MS);
    expect(save).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  }));
});
