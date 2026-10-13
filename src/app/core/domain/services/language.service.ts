import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, tap } from 'rxjs';

export type Language = 'es' | 'en';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';

// Misma clave que usa el admin: `Accept-Language` sale de aquí en cada petición.
const STORAGE_KEY = 'lang';

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

  readonly current = signal<Language>(storedLanguage());

  /**
   * Se llama una vez al arrancar la app: fija el idioma por defecto y carga el guardado.
   * Devuelve el observable de carga: la app espera a tener los textos antes de dibujar (así nunca se ven las claves).
   */
  init(): Observable<unknown> {
    this.translate.addLangs([...SUPPORTED_LANGUAGES]);
    this.translate.setFallbackLang(DEFAULT_LANGUAGE);
    return this.apply(this.current());
  }

  toggle(): void {
    this.set(this.current() === 'es' ? 'en' : 'es');
  }

  set(lang: Language): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Sin almacenamiento el idioma vale solo para esta sesión.
    }
    this.apply(lang).subscribe();
  }

  // Primero se cargan los textos del idioma y solo después se avisa del cambio: las pantallas se vuelven a crear al
  // cambiar `current`, y deben encontrar ya los textos nuevos.
  private apply(lang: Language): Observable<unknown> {
    return this.translate.use(lang).pipe(
      tap(() => {
        this.current.set(lang);
        document.documentElement.lang = lang;
      }),
    );
  }
}
