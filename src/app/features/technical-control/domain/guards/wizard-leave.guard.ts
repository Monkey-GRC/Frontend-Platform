import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { WizardLeaveService } from '../services/wizard-leave.service';

// Salir del asistente de conexión (la X, «Atrás» del navegador o un cambio de ruta) pregunta primero si hay algo que perder.
export const wizardLeaveGuard: CanDeactivateFn<unknown> = () => inject(WizardLeaveService).request();
