import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '@core/domain/services/language.service';
import { DateInput, DateStyle, formatLocalDate } from '@shared/domain/utils/date-format';

/**
 * Formatea una fecha en el idioma activo de la interfaz (`formatLocalDate`, con el formateador cacheado). Impuro: debe reaccionar al cambio de idioma.
 * `calendar` en verdadero para un día `AAAA-MM-DD` (período, ventana, vencimiento): se muestra en UTC y la zona horaria no lo corre un día.
 */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: DateInput, dateStyle: DateStyle = 'medium', withTime = false, calendar = false): string {
    return formatLocalDate(value, this.language.current(), { style: dateStyle, time: withTime, calendar });
  }
}
