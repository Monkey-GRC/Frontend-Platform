import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RegistrationSessionService {
  private readonly apiKeySignal = signal<string | null>(null);

  readonly apiKey = this.apiKeySignal.asReadonly();

  setApiKey(apiKey: string): void {
    this.apiKeySignal.set(apiKey);
  }

  clear(): void {
    this.apiKeySignal.set(null);
  }
}
