import { COMPLIANCE_OPTIONS, provideCatalogStub } from '../../../testing/catalog-options';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Exclusion } from '../../../domain/models/exclusion.models';
import { ExclusionService } from '../../../domain/services/exclusion.service';
import { ExclusionsView } from './exclusions';

const person = { id: 'u1', name: 'Laura', last_name: 'Gómez' };
const exclusion = (id: string, patch: Partial<Exclusion> = {}): Exclusion => ({
  id, service_id: 's1', test: { id: 't1', display_name: 'Cuentas privilegiadas con doble factor' }, asset: { id: 'a1', name: `servidor-${id}` },
  justification: 'Se apaga en noviembre.', technical_justification: 'Aislado de la red.', status: 'approved', is_expired: false,
  valid_from: '2026-10-14', valid_until: '2026-12-31', proposed_by: person, requested_at: '2026-10-14T19:00:00Z', decided_by: null, decision_note: null, decided_at: null, ...patch,
});
// D96: la crea y la decide el administrador en un solo acto, así que nace aprobada y con quién la decidió. Los estados pending y rejected quedan sin uso (datos viejos).
const ADMIN = { id: 'c1', name: 'Marta', last_name: 'Ruiz' };
const APPROVED = exclusion('e2', { decided_by: ADMIN, decided_at: '2026-10-15T10:00:00Z' });
const EXPIRED = exclusion('e5', { is_expired: true, decided_by: ADMIN });
const LEGACY_PENDING = exclusion('e1', { status: 'pending' });
const LEGACY_REJECTED = exclusion('e3', { status: 'rejected', decision_note: 'Sigue guardando datos de clientes.', decided_by: ADMIN });

describe('ExclusionsView', () => {
  let api: jasmine.SpyObj<ExclusionService>;
  let fixture: ComponentFixture<ExclusionsView>;

  function setup(role: string, items: Exclusion[] | 'forbidden' | 'down' = [APPROVED, LEGACY_PENDING, LEGACY_REJECTED]): void {
    api = jasmine.createSpyObj<ExclusionService>('ExclusionService', ['listAll']);
    api.listAll.and.returnValue(
      items === 'forbidden' ? throwError(() => new HttpErrorResponse({ status: 403 })) : items === 'down' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(items),
    );
    TestBed.configureTestingModule({
      imports: [ExclusionsView],
      providers: [provideCatalogStub(), 
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: ExclusionService, useValue: api },
        { provide: ActivatedRoute, useValue: { parent: { paramMap: of(convertToParamMap({ id: 's1' })) } } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { COMPLIANCE: { EXCLUSION_STATUS: { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' } } });
    translate.use('es');
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ExclusionsView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const click = (selector: string) => {
    el().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  it('builds the status filters from the statuses that the backend serves, with their labels', () => {
    setup('admin_empresa');
    const filters = Array.from(el().querySelectorAll('[data-test-filter]')).map((b) => b.getAttribute('data-test-filter'));
    expect(filters).toEqual(['all', ...COMPLIANCE_OPTIONS['exclusion_status'].map((o) => o.value)]);
  });

  it('asks for the exclusions of the service of the route', () => {
    setup('admin_empresa');
    expect(api.listAll).toHaveBeenCalledOnceWith('s1');
  });

  it('shows each exclusion with its test, its asset, its justification, its status and who decided it', () => {
    setup('admin_empresa', [APPROVED]);
    expect(el().querySelectorAll('[data-test-list] > li').length).toBe(1);
    expect(text()).toContain('Cuentas privilegiadas con doble factor');
    expect(text()).toContain('COMPLIANCE.EXCLUSIONS.ASSET');
    expect(text()).toContain('Se apaga en noviembre.');
    expect(text()).toContain('Aislado de la red.');
    expect(text()).toContain('COMPLIANCE.EXCLUSIONS.DECIDED_BY');
  });

  it('has nothing to decide: the administrator decides when creating, so no screen offers to approve or reject', () => {
    for (const role of ['admin_empresa', 'auditor']) {
      TestBed.resetTestingModule();
      setup(role, [APPROVED, LEGACY_PENDING]);
      expect(el().querySelector('[data-test-approve]')).toBeNull();
      expect(el().querySelector('[data-test-reject]')).toBeNull();
      expect(el().querySelector('app-confirm-dialog')).toBeNull();
    }
  });

  it('shows the reason of an old rejection and marks an approved exclusion that already expired', () => {
    setup('admin_empresa', [LEGACY_REJECTED, EXPIRED]);
    expect(el().querySelector('[data-test-decision-note]')!.textContent).toContain('COMPLIANCE.EXCLUSIONS.REJECTED_NOTE');
    expect(el().querySelector('[data-test-expired]')).not.toBeNull();
  });

  it('filters by status', () => {
    setup('auditor');
    click('[data-test-filter="approved"]');
    const rows = el().querySelectorAll('[data-test-list] > li');
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-status')).toBe('approved');
    click('[data-test-filter="all"]');
    expect(el().querySelectorAll('[data-test-list] > li').length).toBe(3);
  });

  it('says so when the role has no access, when the service has none and when it cannot be loaded', () => {
    setup('funcional', 'forbidden');
    expect(text()).toContain('COMPLIANCE.EXCLUSIONS.FORBIDDEN_TITLE');
    TestBed.resetTestingModule();
    setup('admin_empresa', []);
    expect(el().querySelector('[data-test-empty]')!.textContent).toContain('COMPLIANCE.EXCLUSIONS.EMPTY');
    TestBed.resetTestingModule();
    setup('admin_empresa', 'down');
    expect(text()).toContain('COMPLIANCE.EXCLUSIONS.LOAD_ERROR');
    api.listAll.and.returnValue(of([APPROVED]));
    click('[data-test-retry]');
    expect(el().querySelectorAll('[data-test-list] > li').length).toBe(1);
  });
});