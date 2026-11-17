import { Injectable, signal } from '@angular/core';

// Qué se pierde si se sale del asistente de conexión: `none` (nada: sale directo), `discard` (aún no hay activo: se pierde lo que lleva) o `saved` (el activo ya existe como conexión
// pendiente y se puede retomar). El asistente de la plataforma dice el estado; la salida (la X, «Atrás» del navegador o cualquier cambio de ruta) pasa por `request()`, que pregunta si hace falta.
export type LeaveMode = 'none' | 'discard' | 'saved';

@Injectable({ providedIn: 'root' })
export class WizardLeaveService {
  readonly mode = signal<LeaveMode>('none');
  readonly asking = signal(false);
  private resolver: ((leave: boolean) => void) | null = null;

  /** `true` si se puede salir ya; si hay algo que perder, abre la confirmación y espera la respuesta. */
  request(): Promise<boolean> {
    if (this.mode() === 'none') return Promise.resolve(true);
    this.resolver?.(false);
    this.asking.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  answer(leave: boolean): void {
    this.asking.set(false);
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(leave);
  }

  /** El asistente se cierra: no queda nada pendiente. */
  reset(): void {
    this.answer(false);
    this.mode.set('none');
  }
}
