import { TestBed } from '@angular/core/testing';
import { SessionService } from '@core/domain/services/session.service';
import { ActiveComplianceService } from './active-compliance.service';

describe('ActiveComplianceService', () => {
  const user = (id: string) => ({ id, email: 'a@x.com', name: null, last_name: null, role: 'admin_empresa' });

  it('remembers the service for whoever is signed in, and forgets it for somebody else', () => {
    const session = TestBed.inject(SessionService);
    const active = TestBed.inject(ActiveComplianceService);
    session.set(user('u1'), { id: 'c', name: 'ACME' });
    expect(active.serviceId()).toBeNull();
    active.set('s1');
    expect(active.serviceId()).toBe('s1');
    session.set(user('u2'), { id: 'c2', name: 'Otra' });
    expect(active.serviceId()).toBeNull();
  });

  it('clears with null', () => {
    TestBed.inject(SessionService).set(user('u1'), { id: 'c', name: 'ACME' });
    const active = TestBed.inject(ActiveComplianceService);
    active.set('s1');
    active.set(null);
    expect(active.serviceId()).toBeNull();
  });

  it('forgets the active service when the session is closed, even if the same person signs in again', () => {
    const session = TestBed.inject(SessionService);
    const active = TestBed.inject(ActiveComplianceService);
    session.set(user('u1'), { id: 'c', name: 'ACME' });
    TestBed.tick();
    active.set('s1');
    expect(active.serviceId()).toBe('s1');
    session.clear();
    TestBed.tick();
    session.set(user('u1'), { id: 'c', name: 'ACME' });
    expect(active.serviceId()).toBeNull();
  });
});
