import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { TeamMember } from '@shared/domain/models/team.models';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { AssignedPerson, AssignmentItem } from '@features/assignment/domain/models/assignment.models';
import { AssignmentView } from './assignment';

const api = environment.apiUrl;
const envelope = <T>(data: T) => ({ statusCode: 200, message: 'ok', data });

const laura: AssignedPerson = { id: 'r1', name: 'Laura', last_name: 'Gómez', role: 'responsable' };
const pablo: AssignedPerson = { id: 'r2', name: 'Pablo', last_name: 'Ruiz', role: 'responsable' };
const juan: AssignedPerson = { id: 'd1', name: 'Juan', last_name: 'Pérez', role: 'delegado' };

const control = (n: number, over: Partial<AssignmentItem> = {}): AssignmentItem => ({
  client_control_id: `c-${n}`, code: `IAC-${n}`, requirement_codes: ['CC6.1'], name: `Control ${n}`, service: { id: 's-1', name: 'Plataforma' }, categories: ['CC'],
  assignment: 'assigned', owner: laura, executor: null, state: 'effective', ...over,
});

const member = (id: string, role: TeamMember['role'], name: string, over: Partial<TeamMember> = {}): TeamMember => ({
  id, email: `${id}@x.co`, name, last_name: 'X', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-01-01', ...over,
});
const team: TeamMember[] = [
  member('a1', 'admin_empresa', 'Rod'), member('r1', 'responsable', 'Laura'), member('r2', 'responsable', 'Pablo'),
  member('d1', 'delegado', 'Juan', { responsible: { id: 'r1', name: 'Laura', last_name: 'Gómez' } }),
];
const services = [{ id: 's-1', name: 'Plataforma' }, { id: 's-2', name: 'Portal' }];

describe('AssignmentView', () => {
  let fixture: ComponentFixture<AssignmentView>;
  let backend: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector<HTMLElement>(sel);
  const doc = (sel: string) => document.querySelector<HTMLElement>(sel);
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('tbody tr'));
  const page = (items: AssignmentItem[], extra: Partial<{ page: number; total: number; total_pages: number }> = {}) =>
    envelope({ items, page: 1, page_size: 25, total: items.length, total_pages: 1, ...extra });

  async function create(role: string, url = '/'): Promise<void> {
    TestBed.configureTestingModule({ imports: [AssignmentView], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    TestBed.inject(SessionService).set({ id: role === 'admin_empresa' ? 'a1' : 'r1', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(AssignmentView);
    fixture.detectChanges();
  }

  /** Responde lo del arranque: los servicios y el equipo. */
  function boot(): void {
    backend.expectOne((r) => r.url === `${api}/services`).flush(envelope({ items: services, page: 1, page_size: 100, total: 2, total_pages: 1 }));
    backend.expectOne((r) => r.url === `${api}/users`).flush(envelope({ items: team, page: 1, page_size: 100, total: team.length, total_pages: 1 }));
    fixture.detectChanges();
  }

  const listRequest = (matcher?: (r: TestRequest['request']) => boolean): TestRequest => backend.expectOne((r) => r.url === `${api}/assignments` && r.method === 'GET' && (!matcher || matcher(r)));

  async function ready(role = 'admin_empresa', items: AssignmentItem[] = [control(1), control(2, { owner: null, assignment: 'unassigned' })], url = '/'): Promise<void> {
    await create(role, url);
    boot();
    listRequest().flush(page(items));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    backend.verify();
    document.body.querySelectorAll('app-assignment-owner-form, app-assignment-delegate-form').forEach((n) => n.remove());
  });

  it('draws the shape of the screen while it loads: the search, the filters, the selection bar and the table with its columns', async () => {
    await create('admin_empresa');
    expect(q('[data-testid="assignment-loading"]')).not.toBeNull();
    expect(el().querySelectorAll('[data-skeleton-block]').length).toBeGreaterThan(3);
    expect(el().querySelectorAll('thead th').length).toBe(6);
    boot();
    listRequest().flush(page([]));
  });

  it('lists the controls with the code always visible, the owner, who runs it and the status, and the name as an underlined link to the control', async () => {
    await ready('admin_empresa', [control(1, { executor: juan }), control(2, { owner: null, assignment: 'unassigned', state: 'no_tests' }), control(3)]);
    const [first, second, third] = rows();
    expect(first.textContent).toContain('IAC-1');
    expect(first.textContent).toContain('CC6.1');
    expect(first.querySelector('[data-person-name]')!.textContent).toContain('Laura Gómez');
    expect(first.textContent).toContain('Juan Pérez');
    const link = first.querySelector<HTMLAnchorElement>('[data-testid="control-link"]')!;
    expect(link.classList).toContain('underline');
    expect(link.getAttribute('href')).toContain('abrir=c-1');
    expect(link.getAttribute('href')).toContain('servicio=s-1');
    expect(second.querySelector('[data-testid="owner-unassigned"]')).not.toBeNull();
    expect(second.querySelector('[data-testid="executor-none"]')).not.toBeNull();
    expect(second.querySelector('[data-state]')!.getAttribute('data-state')).toBe('no_tests');
    expect(third.querySelector('[data-testid="executor-owner"]')).not.toBeNull();
  });

  it('leaves the first service in the address when it has none, so the link is the real one', async () => {
    await ready();
    expect(router.url).toContain('servicio=s-1');
  });

  it('opens already filtered by the link of the notification: the service and «unassigned» go to the server and show in the filters', async () => {
    await create('admin_empresa', '/?servicio=s-2&asignacion=unassigned');
    boot();
    const req = listRequest((r) => r.params.get('service_id') === 's-2');
    expect(req.request.params.get('assignment')).toBe('unassigned');
    req.flush(page([control(5, { owner: null, assignment: 'unassigned', service: { id: 's-2', name: 'Portal' } })]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(q('app-option-chips [data-option="unassigned"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('[data-testid="assignment-service"]')!.textContent).toContain('Portal');
  });

  it('changing the filter writes it to the address and asks the server again from the first page', async () => {
    await ready();
    el().querySelector<HTMLButtonElement>('app-option-chips [data-option="unassigned"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toContain('asignacion=unassigned');
    const req = listRequest((r) => r.params.get('assignment') === 'unassigned');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([]));
    fixture.detectChanges();
  });

  it('with every control assigned and the filter «unassigned» on, says it is good news instead of an empty table, and offers to clear the filter', async () => {
    await create('admin_empresa', '/?servicio=s-1&asignacion=unassigned');
    boot();
    listRequest().flush(page([]));
    await fixture.whenStable();
    fixture.detectChanges();
    const empty = q('[data-empty]') ?? el();
    expect(empty.textContent).toContain('ASSIGNMENT.EMPTY.ALL_ASSIGNED_TITLE');
    expect(q('[data-testid="assignment-clear"]')).not.toBeNull();
  });

  it('sends the search to the server after a pause, not with every key', fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [AssignmentView], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    TestBed.inject(SessionService).set({ id: 'a1', email: 'a@x.co', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    void router.navigateByUrl('/?servicio=s-1');
    tick();
    fixture = TestBed.createComponent(AssignmentView);
    fixture.detectChanges();
    boot();
    listRequest().flush(page([control(1)]));
    tick();
    fixture.detectChanges();
    const input = q('[data-search-input]') as HTMLInputElement;
    input.value = 'CC6';
    input.dispatchEvent(new Event('input'));
    tick(100);
    backend.expectNone((r) => r.url === `${api}/assignments`);
    tick(300);
    fixture.detectChanges();
    const req = listRequest((r) => r.params.get('q') === 'CC6');
    req.flush(page([control(1)]));
    tick();
    expect(router.url).toContain('q=CC6');
  }));

  it('asks for another page of the server when the page changes', async () => {
    await ready('admin_empresa', [control(1)]);
    fixture.componentInstance.goTo(2);
    const req = listRequest((r) => r.params.get('page') === '2');
    req.flush(page([control(30)], { page: 2, total: 40, total_pages: 2 }));
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain('IAC-30');
  });

  describe('what each role sees', () => {
    it('gives the administrator «Asignar dueño» and «Delegar», off until something is selected, with the owner and assignment filters', async () => {
      await ready('admin_empresa');
      const owner = q('[data-testid="action-owner"]') as HTMLButtonElement;
      const delegate = q('[data-testid="action-delegate"]') as HTMLButtonElement;
      expect(owner.textContent).toContain('ASSIGNMENT.ACTIONS.OWNER');
      expect(delegate.textContent).toContain('ASSIGNMENT.ACTIONS.DELEGATE');
      expect(owner.disabled).toBeTrue();
      expect(delegate.disabled).toBeTrue();
      expect(q('[data-testid="selection-text"]')!.textContent).toContain('ASSIGNMENT.SELECTION.NONE');
      expect(el().querySelector('app-option-chips')).not.toBeNull();
    });

    it('gives the owner only «Delegar» and a filter by delegate, no «Asignar dueño» and no «unassigned» chips', async () => {
      await ready('responsable', [control(1)]);
      expect(q('[data-testid="action-owner"]')).toBeNull();
      expect((q('[data-testid="action-delegate"]') as HTMLButtonElement).textContent).toContain('ASSIGNMENT.ACTIONS.DELEGATE');
      expect(el().querySelector('app-option-chips')).toBeNull();
    });
  });

  describe('assigning in batch', () => {
    const selectRows = async (...indexes: number[]) => {
      for (const i of indexes) {
        (rows()[i].querySelector('[data-select-row]') as HTMLInputElement).click();
        fixture.detectChanges();
      }
      await fixture.whenStable();
    };

    it('turns the actions on with the selection and says how many are selected', async () => {
      await ready();
      await selectRows(0, 1);
      expect(q('[data-testid="selection-text"]')!.textContent).toContain('ASSIGNMENT.SELECTED_MANY');
      expect((q('[data-testid="action-owner"]') as HTMLButtonElement).disabled).toBeFalse();
      (q('[data-testid="selection-clear"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect((q('[data-testid="action-owner"]') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('assigns the owner of the selected controls, shows the result and asks the list again', async () => {
      await ready();
      await selectRows(0, 1);
      (q('[data-testid="action-owner"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(Array.from(doc('[data-testid="owner-controls"]')!.querySelectorAll('app-tag')).map((t) => t.textContent!.trim())).toEqual(['IAC-1', 'IAC-2']);
      pickOption(document, '[data-testid="owner-select"]', 'r2', () => fixture.detectChanges());
      const toast = spyOn(TestBed.inject(ToastService), 'showSuccess');
      (doc('[data-testid="owner-submit"]') as HTMLButtonElement).click();
      const put = backend.expectOne(`${api}/assignments/owner`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ client_control_ids: ['c-1', 'c-2'], owner_id: 'r2' });
      put.flush(envelope({ updated: 2 }));
      expect(toast).toHaveBeenCalled();
      listRequest().flush(page([control(1, { owner: pablo }), control(2, { owner: pablo })]));
      fixture.detectChanges();
      expect(doc('[data-testid="owner-controls"]')).toBeNull();
      expect(q('[data-testid="selection-text"]')!.textContent).toContain('ASSIGNMENT.SELECTION.NONE');
    });

    it('says clearly when the server refuses (409) and keeps the form open with what was chosen', async () => {
      await ready();
      await selectRows(0);
      (q('[data-testid="action-owner"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      pickOption(document, '[data-testid="owner-select"]', 'r2', () => fixture.detectChanges());
      (doc('[data-testid="owner-submit"]') as HTMLButtonElement).click();
      backend.expectOne(`${api}/assignments/owner`).flush({ statusCode: 409, message: 'x', data: null, error: { code: 'OWNER_NOT_ELIGIBLE' } }, { status: 409, statusText: 'Conflict' });
      // Quien ya no puede ser dueño: se vuelve a pedir el equipo para que la lista de candidatos sea la real.
      backend.expectOne((r) => r.url === `${api}/users`).flush(envelope({ items: team, page: 1, page_size: 100, total: team.length, total_pages: 1 }));
      fixture.detectChanges();
      expect(doc('[data-testid="owner-error"]')!.textContent).toContain('ASSIGNMENT.ERROR.OWNER_NOT_ELIGIBLE');
      expect(doc('[data-testid="owner-controls"]')).not.toBeNull();
      expect((doc('[data-testid="owner-submit"]') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('delegates to a delegate of the team of the owner and sends the executor', async () => {
      await ready('admin_empresa', [control(1), control(2)]);
      await selectRows(0, 1);
      (q('[data-testid="action-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      pickOption(document, '[data-testid="delegate-select"]', 'd1', () => fixture.detectChanges());
      (doc('[data-testid="delegate-submit"]') as HTMLButtonElement).click();
      const put = backend.expectOne(`${api}/assignments/executor`);
      expect(put.request.body).toEqual({ client_control_ids: ['c-1', 'c-2'], executor_id: 'd1' });
      put.flush(envelope({ updated: 2 }));
      listRequest().flush(page([control(1, { executor: juan }), control(2, { executor: juan })]));
    });

    it('with controls of different owners, the administrator can only remove the delegate (no delegate serves two teams)', async () => {
      await ready('admin_empresa', [control(1), control(2, { owner: pablo })]);
      await selectRows(0, 1);
      (q('[data-testid="action-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(doc('[data-testid="delegate-reason"]')!.textContent).toContain('REASON_MIXED_OWNERS');
      expect(doc('[data-testid="delegate-select"]')).toBeNull();
    });

    it('the owner delegates among the delegates of their team', async () => {
      await ready('responsable', [control(1)]);
      await selectRows(0);
      (q('[data-testid="action-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      pickOption(document, '[data-testid="delegate-select"]', 'd1', () => fixture.detectChanges());
      (doc('[data-testid="delegate-submit"]') as HTMLButtonElement).click();
      backend.expectOne(`${api}/assignments/executor`).flush({ statusCode: 409, message: 'No está en el equipo', data: null, error: { code: 'EXECUTOR_NOT_IN_TEAM' } }, { status: 409, statusText: 'Conflict' });
      backend.expectOne((r) => r.url === `${api}/users`).flush(envelope({ items: team, page: 1, page_size: 100, total: team.length, total_pages: 1 }));
      fixture.detectChanges();
      expect(doc('[data-testid="delegate-error"]')!.textContent).toContain('ASSIGNMENT.ERROR.EXECUTOR_NOT_IN_TEAM');
    });

    it('says nothing changed when the server reports zero updated', async () => {
      await ready();
      await selectRows(0);
      (q('[data-testid="action-owner"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      pickOption(document, '[data-testid="owner-select"]', 'r1', () => fixture.detectChanges());
      const info = spyOn(TestBed.inject(ToastService), 'showInfo');
      (doc('[data-testid="owner-submit"]') as HTMLButtonElement).click();
      backend.expectOne(`${api}/assignments/owner`).flush(envelope({ updated: 0 }));
      listRequest().flush(page([control(1)]));
      expect(info).toHaveBeenCalled();
    });
  });

  it('says there are no services, and where they are created, to the administrator', async () => {
    await create('admin_empresa');
    backend.expectOne((r) => r.url === `${api}/services`).flush(envelope({ items: [], page: 1, page_size: 100, total: 0, total_pages: 0 }));
    backend.expectOne((r) => r.url === `${api}/users`).flush(envelope({ items: team, page: 1, page_size: 100, total: 4, total_pages: 1 }));
    fixture.detectChanges();
    expect(q('[data-testid="assignment-no-services"]')).not.toBeNull();
    expect(el().querySelector('a[href="/services"]')!.classList).toContain('underline');
  });

  it('offers to retry when the list does not load, and loads it again', async () => {
    await create('admin_empresa', '/?servicio=s-1');
    boot();
    listRequest().error(new ProgressEvent('error'));
    fixture.detectChanges();
    (q('[data-testid="assignment-retry"]') as HTMLButtonElement).click();
    listRequest().flush(page([control(1)]));
    fixture.detectChanges();
    expect(rows().length).toBe(1);
  });

  it('offers to retry when the services do not load', async () => {
    await create('admin_empresa');
    backend.expectOne((r) => r.url === `${api}/services`).flush(null, { status: 500, statusText: 'Server Error' });
    backend.expectOne((r) => r.url === `${api}/users`).flush(envelope({ items: team, page: 1, page_size: 100, total: 4, total_pages: 1 }));
    fixture.detectChanges();
    (q('[data-testid="assignment-retry-services"]') as HTMLButtonElement).click();
    backend.expectOne((r) => r.url === `${api}/services`).flush(envelope({ items: services, page: 1, page_size: 100, total: 2, total_pages: 1 }));
    fixture.detectChanges();
    listRequest().flush(page([]));
  });
});
