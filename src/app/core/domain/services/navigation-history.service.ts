import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

// Ajustes es una pantalla completa fuera del layout de la app: para «Volver a la aplicación» hace falta saber en qué pantalla estaba la persona. Recuerda la última
// dirección que no es de Ajustes. Hay que instanciarlo en cuanto arranca el layout (lo hace `AppLayoutComponent`) para que ya esté escuchando cuando se vaya a Ajustes.
const isSettings = (url: string): boolean => /^\/ajustes(?:[/?#]|$)/.test(url);

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private lastAppUrl: string | null = null;

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      if (!isSettings(event.urlAfterRedirects)) this.lastAppUrl = event.urlAfterRedirects;
    });
  }

  /** La última pantalla de la app que vio la persona; el inicio si entró directo a Ajustes. */
  get returnUrl(): string {
    return this.lastAppUrl ?? '/';
  }
}
