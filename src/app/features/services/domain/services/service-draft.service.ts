import { Injectable } from '@angular/core';
import { ServiceDraft } from '../models/service.models';

export interface StoredServiceDraft {
  draft: ServiceDraft;
  step: number;
}

// Guarda el avance del cliente en su navegador mientras declara un servicio nuevo, para que si
// se interrumpe (o la sesión vence a los 30 min sin actividad) retome donde iba. Es solo un
// borrador: lo definitivo se guarda en el backend al final y el borrador se borra entonces.
// Va por usuario y solo guarda respuestas de negocio del formulario, nada sensible.
@Injectable({ providedIn: 'root' })
export class ServiceDraftService {
  private key(userId: string): string {
    return `mnk_onboarding_c2_${userId}`;
  }

  load(userId: string): StoredServiceDraft | null {
    try {
      const raw = localStorage.getItem(this.key(userId));
      return raw ? (JSON.parse(raw) as StoredServiceDraft) : null;
    } catch {
      return null; // almacenamiento bloqueado o dato corrupto: se empieza de cero
    }
  }

  save(userId: string, value: StoredServiceDraft): void {
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
