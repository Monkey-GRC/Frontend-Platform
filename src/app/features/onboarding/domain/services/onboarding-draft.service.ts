import { Injectable } from '@angular/core';
import { OrganizationalContextDraft } from '../models/organizational-context.models';

export interface StoredDraft {
  draft: OrganizationalContextDraft;
  step: number;
}

// Guarda el avance del cliente en su navegador mientras llena el formulario, para que si se
// interrumpe (o la sesión vence a los 30 min sin actividad) retome donde iba. Es solo un
// borrador: lo definitivo se guarda en el backend al final, y el borrador se borra entonces.
// Va por usuario, y nunca guarda nada sensible (solo respuestas de negocio del formulario).
@Injectable({ providedIn: 'root' })
export class OnboardingDraftService {
  private key(userId: string): string {
    return `mnk_onboarding_c1_${userId}`;
  }

  load(userId: string): StoredDraft | null {
    try {
      const raw = localStorage.getItem(this.key(userId));
      return raw ? (JSON.parse(raw) as StoredDraft) : null;
    } catch {
      return null; // almacenamiento bloqueado o dato corrupto: se empieza de cero
    }
  }

  save(userId: string, value: StoredDraft): void {
    try {
      localStorage.setItem(this.key(userId), JSON.stringify(value));
    } catch {
      /* sin almacenamiento: el formulario funciona igual, solo sin borrador */
    }
  }

  clear(userId: string): void {
    try {
      localStorage.removeItem(this.key(userId));
    } catch {
      /* nada que limpiar */
    }
  }
}
