import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '@core/domain/services/language.service';

/** Formatea una fecha en el idioma activo de la interfaz. Impuro: debe reaccionar al cambio de idioma. */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | number | Date | null | undefined, dateStyle: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
    if (value === null || value === undefined || value === '') return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle }).format(date);
  }
}
