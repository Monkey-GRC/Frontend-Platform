import { TestBed } from '@angular/core/testing';
import { SessionService } from '@core/domain/services/session.service';
import { ComplianceViewService } from './compliance-view.service';

describe('ComplianceViewService', () => {
  function as(role: string | null): ComplianceViewService {
    TestBed.configureTestingModule({});
    if (role) {
      TestBed.inject(SessionService).set(
        { id: 'u1', email: 'a@x.com', name: null, last_name: null, role },
        { id: 'c1', name: 'ACME' },
      );
    }
    return TestBed.inject(ComplianceViewService);
  }

  it('gives the technical view to the company admin and the auditor only', () => {
    for (const role of ['admin_empresa', 'auditor']) {
      TestBed.resetTestingModule();
      const view = as(role);
      expect(view.isTechnicalView()).toBeTrue();
      expect(view.viewParam()).toBe('technical');
    }
  });

  it('keeps the business view for the functional user, with no view parameter', () => {
    for (const role of ['funcional']) {
      TestBed.resetTestingModule();
      const view = as(role);
      expect(view.isTechnicalView()).toBeFalse();
      expect(view.viewParam()).toBeUndefined();
    }
  });

  it('shows the business view when nobody is signed in', () => {
    const view = as(null);
    expect(view.isTechnicalView()).toBeFalse();
    expect(view.canOpenService()).toBeFalse();
  });

  it('lets only the company admin open the service screen', () => {
    expect(as('admin_empresa').canOpenService()).toBeTrue();
    TestBed.resetTestingModule();
    expect(as('auditor').canOpenService()).toBeFalse();
  });
});
