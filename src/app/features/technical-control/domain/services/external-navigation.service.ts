import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** El inicio de sesión de Microsoft: el único destino externo al que el asistente manda el navegador. */
const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com/';

// Salir de la app hacia la página del proveedor. Solo a la dirección de inicio de sesión de Microsoft: una respuesta rara del servidor no puede mandar al cliente a otro sitio.
@Injectable({ providedIn: 'root' })
export class ExternalNavigation {
  private readonly document = inject(DOCUMENT);

  /** `false` si el destino no es el esperado y no se navegó. */
  toMicrosoft(url: string): boolean {
    if (!url.startsWith(MICROSOFT_AUTHORITY)) return false;
    this.document.location.assign(url);
    return true;
  }
}
