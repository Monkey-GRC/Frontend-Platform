import { InjectionToken } from '@angular/core';

// D98 · Hoy un funcional atiende todo lo de sus especialidades, sin que nadie se lo asigne. Repartir el trabajo a personas concretas (el responsable de una dimensión en un
// servicio, la excepción de un control) existe en el Backend pero queda apagado en la interfaz hasta que se decida cómo usarlo.
export const OWNER_ASSIGNMENT_ENABLED = new InjectionToken<boolean>('OWNER_ASSIGNMENT_ENABLED', { providedIn: 'root', factory: () => false });
