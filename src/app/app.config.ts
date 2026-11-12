import { ApplicationConfig, inject, provideAppInitializer, Injector, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, provideRouter, TitleStrategy, withPreloading } from '@angular/router';
import { HttpBackend, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader';
import { credentialsInterceptor } from '@core/domain/interceptors/credentials.interceptor';
import { ThemeService } from '@core/domain/services/theme.service';
import { LanguageService, Language, SAVE_LANGUAGE } from '@core/domain/services/language.service';

import { PageTitleStrategy } from '@core/domain/services/page-title.strategy';
import { routes } from './app.routes';
import { AuthService } from '@core/domain/services/auth.service';
import { SessionService } from '@core/domain/services/session.service';

// Un archivo por área en `public/i18n/{es,en}/`. Se carga con HttpBackend a propósito: así no pasa
// por `credentialsInterceptor` y no necesita sesión (el login ya se muestra traducido).
export const I18N_FILES = ['common', 'shell', 'home', 'auth', 'onboarding', 'services', 'technical-control', 'integrations', 'compliance', 'team', 'settings'] as const;

export function httpLoaderFactory(httpBackend: HttpBackend): MultiTranslateHttpLoader {
  return new MultiTranslateHttpLoader(
    httpBackend,
    I18N_FILES.map((file) => ({ prefix: './i18n/', suffix: `/${file}.json` })),
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Las pantallas se descargan en segundo plano apenas arranca la app, para que abrirlas no espere a la red (Ajustes, Volver).
    provideRouter(routes, withPreloading(PreloadAllModules)),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    provideTranslateService({
      loader: { provide: TranslateLoader, useFactory: httpLoaderFactory, deps: [HttpBackend] },
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    // Guarda el idioma de la persona con sesión (D111). Se resuelve al usarlo: así LanguageService y AuthService no se piden uno al otro.
    {
      provide: SAVE_LANGUAGE,
      useFactory: () => {
        const injector = inject(Injector);
        return (lang: Language) => (injector.get(SessionService).isAuthenticated() ? injector.get(AuthService).saveLanguage(lang) : null);
      },
    },
    // El tema (claro/oscuro) se aplica al arrancar, en CUALQUIER pantalla: antes solo lo hacía el selector de tema, que no existe en las pantallas fuera del layout (Ajustes).
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ]
};
