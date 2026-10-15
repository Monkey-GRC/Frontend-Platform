import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

// Texto de un valor de enum que el backend no sirve como catálogo (criterio de riesgo, nivel, categoría de falla, tipo de pérdida…): se busca en
// el i18n por valor (`<PREFIJO>.<VALOR>` en mayúsculas). Un valor que no tiene texto se muestra tal cual llegó, para que uno nuevo del backend
// nunca rompa ni se oculte la pantalla. Las plantillas lo llaman como `labels.of('COMPLIANCE.RISK_LEVEL', value)` y se refrescan solas al
// cambiar el idioma o al terminar de cargar las traducciones.
@Injectable({ providedIn: 'root' })
export class EnumLabelService {
  private readonly translate = inject(TranslateService);
  private readonly tick = signal(0);

  constructor() {
    merge(this.translate.onLangChange, this.translate.onTranslationChange).subscribe(() => this.tick.update((n) => n + 1));
  }

  of(prefix: string, value: string | null | undefined): string {
    this.tick();
    if (!value) return '—';
    const key = `${prefix}.${value.toUpperCase()}`;
    const text = this.translate.instant(key);
    return text === key ? value : text;
  }
}
