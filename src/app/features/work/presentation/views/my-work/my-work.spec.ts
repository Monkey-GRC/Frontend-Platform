import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { WorkItem } from '@features/work/domain/models/work.models';
import { WorkService } from '@features/work/domain/services/work.service';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { MyWorkView } from './my-work';

const ITEM: WorkItem = {
  client_control_id: 'c1', code: 'IAC-12', title: 'Gestión de accesos', service: { id: 's1', name: 'Servicio IA' }, role_in_control: 'approver', bucket: 'to_review', pending_items: 2,
  pending_decisions: ['control_approval', 'level_override'], state: 'in_progress',
};
const PAGE = { page: { page: 1, pageSize: 25, total: 1, totalPages: 1 } };

describe('MyWorkView', () => {
  let api: jasmine.SpyObj<WorkService>;
  let router: jasmine.SpyObj<Router>;
  let fixture: ComponentFixture<MyWorkView>;

  function setup(items: WorkItem[] | 'error'): HTMLElement {
    api = jasmine.createSpyObj<WorkService>('WorkService', ['toReview']);
    api.toReview.and.returnValue(items === 'error' ? throwError(() => new Error('x')) : of({ items, ...PAGE }));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const catalogs = { options: () => of([{ value: 'control_approval', label: 'Aprobar el control' }, { value: 'level_override', label: 'Decidir una corrección de nivel' }]) };
    TestBed.configureTestingModule({ imports: [MyWorkView], providers: [provideTranslateService(), { provide: WorkService, useValue: api }, { provide: Router, useValue: router }, { provide: CatalogService, useValue: catalogs }] });
    fixture = TestBed.createComponent(MyWorkView);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('asks for the first page of the to_review bucket and shows the code, the title, the service and what each control waits for, from the catalog', () => {
    const el = setup([ITEM]);
    expect(api.toReview).toHaveBeenCalledWith(1, 25);
    expect(el.textContent).toContain('IAC-12');
    expect(el.textContent).toContain('Gestión de accesos');
    expect(el.textContent).toContain('Servicio IA');
    expect(el.querySelector('[data-waiting]')?.textContent).toContain('Aprobar el control');
    expect(el.querySelector('[data-waiting]')?.textContent).toContain('Decidir una corrección de nivel');
  });

  it('says there is nothing to approve when the list is empty', () => {
    expect(setup([]).textContent).toContain('WORK.REVIEW.EMPTY');
  });

  it('opens the control in its Approval tab, in its service, when a row is clicked', () => {
    setup([ITEM]);
    fixture.componentInstance.open(ITEM);
    expect(router.navigate).toHaveBeenCalledWith(['/cumplimiento', 'controles'], { queryParams: { abrir: 'c1', tab: 'approval', servicio: 's1' } });
  });

  it('shows an error with a retry that asks again', () => {
    const el = setup('error');
    expect(el.querySelector('[data-test-error]')).not.toBeNull();
    api.toReview.and.returnValue(of({ items: [ITEM], ...PAGE }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('ready');
  });

  it('asks the server for the page that is picked', () => {
    setup([ITEM]);
    fixture.componentInstance.goTo(2);
    expect(api.toReview).toHaveBeenCalledWith(2, 25);
    fixture.componentInstance.resize(10);
    expect(api.toReview).toHaveBeenCalledWith(1, 10);
  });

  it('discards the answer of an older request that arrives after a newer one', () => {
    setup([ITEM]);
    const old = new Subject<{ items: WorkItem[]; page: PageInfo }>();
    const fresh = new Subject<{ items: WorkItem[]; page: PageInfo }>();
    api.toReview.and.returnValues(old, fresh);
    fixture.componentInstance.load();
    fixture.componentInstance.load();
    fresh.next({ items: [{ ...ITEM, code: 'NEW-1' }], ...PAGE });
    old.next({ items: [{ ...ITEM, code: 'OLD-9' }], ...PAGE });
    expect(fixture.componentInstance.items()[0].code).toBe('NEW-1');
  });

  it('labels what each control waits for with the catalog of the session language', () => {
    setup([ITEM]);
    expect(fixture.componentInstance.kindLabel('control_approval')).toBe('Aprobar el control');
    expect(fixture.componentInstance.kindLabel('new_kind')).toBe('new_kind');
  });

  it('dims the table and ignores another page change while a page change is loading, with rows already shown', () => {
    setup([ITEM]);
    const late = new Subject<{ items: WorkItem[]; page: PageInfo }>();
    api.toReview.and.returnValue(late);
    const view = fixture.componentInstance;
    view.goTo(2);
    fixture.detectChanges();
    expect(view.refreshing()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-table-wrap]')!.hasAttribute('inert')).toBeTrue();
    view.goTo(3);
    view.resize(50);
    expect(api.toReview).toHaveBeenCalledTimes(2);
    late.next({ items: [ITEM], page: PAGE.page });
    fixture.detectChanges();
    expect(view.refreshing()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-table-wrap]')!.hasAttribute('inert')).toBeFalse();
  });

  it('while it loads, marks the zone busy with a progress bar, and the text after 2 s; when it ends the busy mark goes away', fakeAsync(() => {
    const pending = new Subject<{ items: WorkItem[]; page: PageInfo }>();
    api = jasmine.createSpyObj<WorkService>('WorkService', ['toReview']);
    api.toReview.and.returnValue(pending);
    TestBed.configureTestingModule({ imports: [MyWorkView], providers: [provideTranslateService(), { provide: WorkService, useValue: api }, { provide: Router, useValue: { navigate: () => Promise.resolve(true) } }, { provide: CatalogService, useValue: { options: () => of([]) } }] });
    fixture = TestBed.createComponent(MyWorkView);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-skeleton-region')!.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('[data-load-progress]')).not.toBeNull();
    expect(el.querySelector('[data-slow-load]')).toBeNull();
    tick(2000);
    fixture.detectChanges();
    expect(el.querySelector('[data-slow-load]')).not.toBeNull();
    pending.next({ items: [ITEM], ...PAGE });
    fixture.detectChanges();
    expect(el.querySelector('app-skeleton-region')!.hasAttribute('aria-busy')).toBeFalse();
    discardPeriodicTasks();
    flush();
  }));

  it('does not stay loading when the request never answers: after the timeout it shows the error with Retry', fakeAsync(() => {
    api = jasmine.createSpyObj<WorkService>('WorkService', ['toReview']);
    api.toReview.and.returnValue(new Subject());
    TestBed.configureTestingModule({ imports: [MyWorkView], providers: [provideTranslateService(), { provide: WorkService, useValue: api }, { provide: Router, useValue: { navigate: () => Promise.resolve(true) } }, { provide: CatalogService, useValue: { options: () => of([]) } }] });
    fixture = TestBed.createComponent(MyWorkView);
    fixture.detectChanges();
    tick(LOAD_TIMEOUT_MS);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test-error]')!.textContent).toContain('COMMON.RETRY');
    expect(el.querySelector('[aria-busy="true"]')).toBeNull();
  }));
});
