import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, catchError, forkJoin, of, tap, timer } from 'rxjs';
import { setMissingDataTranslator } from '@shared/domain/utils/unwrap-response';

export type Language = 'es' | 'en';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';

// Misma clave que usa el admin: `Accept-Language` sale de aquí en cada petición.
const STORAGE_KEY = 'lang';

// Tiempo para que la capa de carga se pinte antes de recargar.
export const LANGUAGE_RELOAD_DELAY_MS = 150;

/** Recarga la página; es un token para poder sustituirlo en las pruebas. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/** ¿La persona eligió un idioma en este navegador (menú o botón ES/EN)? Si no, lo que se ve es solo el valor por defecto. */
export function hasChosenLanguage(): boolean {
  try {
    return SUPPORTED_LANGUAGES.includes(localStorage.getItem(STORAGE_KEY) as Language);
  } catch {
    return false;
  }
}

/**
 * Guarda el idioma en el servidor para la persona con sesión; `null` si no hay sesión. Lo provee app.config (así este servicio no depende del AuthService).
 */
export const SAVE_LANGUAGE = new InjectionToken<(lang: Language) => Observable<void> | null>('SAVE_LANGUAGE', {
  providedIn: 'root',
  factory: () => () => null,
});

/** Lee el idioma guardado de forma síncrona; el interceptor lo usa sin inyectar el servicio. */
export function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(value as Language) ? (value as Language) : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly reload = inject(RELOAD_PAGE);
  private readonly saveLanguage = inject(SAVE_LANGUAGE);

  constructor() {
    setMissingDataTranslator((key) => String(this.translate.instant(key)));
  }

  /** Idioma con el que arrancó la app. No cambia durante la sesión: cambiarlo recarga la página. */
  readonly current = signal<Language>(storedLanguage());

  /** Texto de la capa de carga (ya en el idioma de destino) mientras la app se recarga; `null` si no hay cambio en curso. */
  readonly switchingMessage = signal<string | null>(null);

  /**
   * Se llama una vez al arrancar la app: fija el idioma por defecto y carga el guardado.
   * Devuelve el observable de carga: la app espera a tener los textos antes de dibujar (así nunca se ven las claves).
   */
  init(): Observable<unknown> {
    this.translate.addLangs([...SUPPORTED_LANGUAGES]);
    this.translate.setFallbackLang(DEFAULT_LANGUAGE);
    const lang = this.current();
    return this.translate.use(lang).pipe(tap(() => (document.documentElement.lang = lang)));
  }

  toggle(): void {
    this.set(this.current() === 'es' ? 'en' : 'es');
  }

  /**
   * Guarda el idioma, tapa la app con una capa de carga en el idioma de destino y recarga la página: así todo (también lo que
   * traduce el backend) queda en el idioma nuevo sin depender de cada vista.
   */
  set(lang: Language): void {
    this.switchTo(lang, true);
  }

  /** La cuenta manda (el navegador no tenía idioma elegido): se guarda como elegido y se cambia con la capa de carga, sin avisar al servidor. */
  adoptAccountLanguage(lang: Language): void {
    if (lang === this.current()) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Sin almacenamiento el idioma vale solo para esta sesión.
      }
      return;
    }
    this.switchTo(lang, false);
  }

  private switchTo(lang: Language, saveOnServer: boolean): void {
    if (lang === this.current() || this.switchingMessage() !== null) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Sin almacenamiento el idioma vale solo para esta sesión.
    }
    this.translate
      .use(lang)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        document.documentElement.lang = lang;
        this.switchingMessage.set(String(this.translate.instant('COMMON.LANGUAGE_SWITCHING')));
        // Con sesión abierta se guarda el idioma en el servidor (para sus correos) antes de recargar; si falla, igual se recarga.
        const remote = saveOnServer ? this.saveLanguage(lang) : null;
        const saved = remote ? remote.pipe(catchError(() => of(null))) : of(null);
        forkJoin([timer(LANGUAGE_RELOAD_DELAY_MS), saved]).subscribe(() => this.reload());
      });
  }
}
