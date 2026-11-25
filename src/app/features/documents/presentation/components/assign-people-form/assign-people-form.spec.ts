import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { TeamMember } from '@shared/domain/models/team.models';
import { TeamService } from '@shared/domain/services/team.service';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { AssignPeopleForm } from './assign-people-form';

const person = (id: string, role: TeamMember['role'], name: string, over: Partial<TeamMember> = {}): TeamMember => ({
  id, email: `${id}@acme.co`, name, last_name: 'Pérez', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
});
const TEAM = [
  person('a1', 'admin_empresa', 'Laura'),
  person('r1', 'responsable', 'María'),
  person('d1', 'delegado', 'Dani'),
  person('c1', 'colaborador', 'Coco'),
  person('c2', 'colaborador', 'Pedro', { status: 'pending' }),
  person('c3', 'colaborador', 'Inés', { status: 'inactive' }),
  person('u1', 'auditor', 'Sofía'),
];

describe('AssignPeopleForm (D152: asignar en lote)', () => {
  let team: jasmine.SpyObj<TeamService>;
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<AssignPeopleForm>;
  let form: AssignPeopleForm;

  function setup(members = of(TEAM), assigned: string[] = []): void {
    team = jasmine.createSpyObj<TeamService>('TeamService', ['listAll']);
    team.listAll.and.returnValue(members);
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['assign']);
    api.assign.and.returnValue(of(2));
    TestBed.configureTestingModule({ imports: [AssignPeopleForm], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: team }, { provide: DocumentService, useValue: api }] });
    fixture = TestBed.createComponent(AssignPeopleForm);
    fixture.componentRef.setInput('documentId', 'd1');
    fixture.componentRef.setInput('assignedUserIds', assigned);
    fixture.detectChanges();
    form = fixture.componentInstance;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const emails = () => Array.from(el().querySelectorAll('[data-test-person]')).map((e) => e.getAttribute('data-test-person'));
  const search = (value: string) => {
    const input = q<HTMLInputElement>('[data-search-input]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const check = (email: string) => {
    const row = q(`[data-test-person="${email}"]`)!.closest('tr')!;
    row.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
  };
  const submit = () => {
    q<HTMLFormElement>('#assign-form')!.requestSubmit();
    fixture.detectChanges();
  };

  it('offers only who can accept and has a live account: not the auditor, not an inactive account', () => {
    setup();
    expect(emails()).toEqual(['a1@acme.co', 'r1@acme.co', 'd1@acme.co', 'c1@acme.co', 'c2@acme.co']);
  });

  it('does not offer again whoever already has it assigned', () => {
    setup(of(TEAM), ['c1', 'r1']);
    expect(emails()).toEqual(['a1@acme.co', 'd1@acme.co', 'c2@acme.co']);
  });

  it('searches by name or email and filters by role', () => {
    setup();
    search('coco');
    expect(emails()).toEqual(['c1@acme.co']);
    search('');
    pickOption(el(), '[data-test-filter-role]', 'colaborador', () => fixture.detectChanges());
    expect(emails()).toEqual(['c1@acme.co', 'c2@acme.co']);
  });

  it('says what happened when nothing matches or when everybody already has it, instead of an empty table', () => {
    setup();
    search('zzz');
    expect(el().textContent).toContain('DOCUMENTS.ASSIGN.EMPTY_FILTERED_TITLE');
    TestBed.resetTestingModule();
    setup(of(TEAM), ['a1', 'r1', 'd1', 'c1', 'c2']);
    expect(el().textContent).toContain('DOCUMENTS.ASSIGN.EMPTY_TITLE');
  });

  it('keeps the people chosen while searching, counts them against the limit and sends them together in one batch', () => {
    setup();
    check('c1@acme.co');
    search('maría');
    check('r1@acme.co');
    search('');
    expect(form.count()).toBe(2);
    expect(q('[data-test-count]')!.textContent).toContain('DOCUMENTS.ASSIGN.SELECTED');
    expect(form.canSubmit()).toBeTrue();
    const assigned = jasmine.createSpy('assigned');
    form.assigned.subscribe(assigned);
    submit();
    expect(api.assign).toHaveBeenCalledOnceWith('d1', ['c1', 'r1']);
    expect(assigned).toHaveBeenCalledOnceWith(2);
  });

  it('cannot be sent without choosing anybody, nor with more people than the limit', () => {
    setup();
    expect(form.canSubmit()).toBeFalse();
    submit();
    expect(api.assign).not.toHaveBeenCalled();
    form.setSelected(new Set(Array.from({ length: 201 }, (_, i) => `u${i}`)));
    expect(form.overLimit()).toBeTrue();
    expect(form.canSubmit()).toBeFalse();
  });

  it('clears the selection', () => {
    setup();
    check('c1@acme.co');
    q<HTMLButtonElement>('[data-test-clear-selection]')!.click();
    fixture.detectChanges();
    expect(form.count()).toBe(0);
  });

  it('explains the refusals, all or nothing, and keeps the selection', () => {
    setup();
    check('c1@acme.co');
    api.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'ASSIGNEE_NOT_ELIGIBLE', user_ids: ['c1', 'r1'] } } })));
    submit();
    expect(q('[data-test-form-error]')!.textContent).toContain('DOCUMENTS.ASSIGN.ERROR.NOT_ELIGIBLE');
    expect(form.count()).toBe(1);
    api.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'DOCUMENT_NOT_PUBLISHED' } } })));
    submit();
    expect(q('[data-test-form-error]')!.textContent).toContain('DOCUMENTS.ASSIGN.ERROR.NOT_PUBLISHED');
    api.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Falló el servidor' } })));
    submit();
    expect(q('[data-test-form-error]')!.textContent).toContain('Falló el servidor');
  });

  it('ignores a second submit while the call runs', () => {
    setup();
    check('c1@acme.co');
    api.assign.and.returnValue(NEVER);
    submit();
    submit();
    expect(api.assign).toHaveBeenCalledTimes(1);
    expect(form.saving()).toBeTrue();
  });

  it('shows the skeleton of the table while the people arrive, and a retry when they cannot be loaded', () => {
    setup(NEVER);
    expect(el().querySelector('[data-skeleton], app-skeleton')).not.toBeNull();
    TestBed.resetTestingModule();
    setup(throwError(() => new Error('500')));
    expect(q('[data-test-load-error]')).not.toBeNull();
    team.listAll.and.returnValue(of(TEAM));
    q<HTMLButtonElement>('[data-test-retry]')!.click();
    fixture.detectChanges();
    expect(emails().length).toBe(5);
  });
});
