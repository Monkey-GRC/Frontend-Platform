import { Injectable } from '@angular/core';

const IDENTIFIER_KEY = 'mnk_client_identifier';
const CLIENT_KEY_KEY = 'mnk_client_key';

export interface TenantCredentials {
  identifier: string;
  key: string;
}

@Injectable({ providedIn: 'root' })
export class TenantCredentialsService {
  save(identifier: string, key: string): void {
    localStorage.setItem(IDENTIFIER_KEY, identifier);
    localStorage.setItem(CLIENT_KEY_KEY, key);
  }

  get(): TenantCredentials | null {
    const identifier = localStorage.getItem(IDENTIFIER_KEY);
    const key = localStorage.getItem(CLIENT_KEY_KEY);
    return identifier && key ? { identifier, key } : null;
  }

  clear(): void {
    localStorage.removeItem(IDENTIFIER_KEY);
    localStorage.removeItem(CLIENT_KEY_KEY);
  }
}
