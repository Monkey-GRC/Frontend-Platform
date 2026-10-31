import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

const APP_NAME = 'Monkey';

// El título de la pestaña sigue a la pantalla: «Cumplimiento · Riesgos | Monkey». Cada ruta declara `title` con una clave de
// i18n (`PAGE_TITLE.*`); aquí se traduce y se vuelve a traducir al cambiar de idioma. Sin título de ruta queda solo el nombre.
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private subscription?: Subscription;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.subscription?.unsubscribe();
    const key = this.buildTitle(snapshot);
    if (!key) {
      this.title.setTitle(APP_NAME);
      return;
    }
    this.subscription = this.translate.stream(key).subscribe((page) => this.title.setTitle(page && page !== key ? `${page} | ${APP_NAME}` : APP_NAME));
  }
}
