import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private authenticatedSubject = new BehaviorSubject<boolean>(false);
  authenticated$ = this.authenticatedSubject.asObservable();

  setAuthenticated(): void {
    this.authenticatedSubject.next(true);
  }

  clear(): void {
    this.authenticatedSubject.next(false);
  }

  get isAuthenticated(): boolean {
    return this.authenticatedSubject.value;
  }
}
