import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { DocumentListItem } from '@features/documents/domain/models/document.models';
import { DocumentService, Page } from '@features/documents/domain/services/document.service';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { DocumentDetailPanel } from '../../components/document-detail-panel/document-detail-panel';
import { DocumentsListView } from './documents-list';

const doc = (id: string, over: Partial<DocumentListItem> = {}): DocumentListItem => ({
  id,
  code: `POL-00${id}`,
  name: `Política ${id}`,
  type: 'policy',
  origin: 'internal',
  acceptance: 'users_who_apply',
  current_version: { id: `v${id}`, number: 2, approved_at: '2026-11-01', is_imported_approval: true, file_name: 'a.pdf', file_type: 'application/pdf' },
  assignments: { total: 5, accepted: 3, pending: 1, overdue: 1 },
  ...over,
});
const pageOf = (items: DocumentListItem[], total = items.length): Page<DocumentListItem> => ({ items, page: { page: 1, pageSize: 25, total, totalPages: Math.max(1, Math.ceil(total / 25)) } });
const ROWS = [doc('1'), doc('2', { current_version: null, assignments: { total: 0, accepted: 0, pending: 0, overdue: 0 } }), doc('3', { assignments: { total: 2, accepted: 2, pending: 0, overdue: 0 } })];

describe('DocumentsListView (MD-503: la biblioteca de la empresa)', () => {
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<DocumentsListView>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function setup(role = 'admin_empresa', list = of(pageOf(ROWS))): void {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['list', 'catalog', 'get']);
    api.list.and.returnValue(list);
    api.catalog.and.callFake((name) => of(name === 'document_type' ? [{ value: 'policy', label: 'Política' }, { value: 'procedure', label: 'Procedimiento' }] : []));
    api.get.and.returnValue(NEVER);
    query = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [DocumentsListView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), provideRouter([]), { provide: DocumentService, useValue: api }, { provide: ActivatedRoute, useValue: { queryParamMap: query } }],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(DocumentsListView);
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const lastCall = () => api.list.calls.mostRecent().args[0];
  const search = (value: string) => {
    const input = el().querySelector<HTMLInputElement>('[data-search-input]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('draws the table with its skeleton while the first page arrives, and no empty state meanwhile', () => {
    setup('admin_empresa', NEVER);
    expect(el().textContent).not.toContain('DOCUMENTS.LIST.EMPTY_TITLE');
    expect(el().querySelector('app-skeleton, [data-skeleton]')).not.toBeNull();
    expect(el().querySelector('[data-search-input]')).not.toBeNull(); // el buscador ya está, a todo el ancho
  });

  it('lists the documents with the code always visible, the version and how many accepted out of how many', () => {
    setup();
    expect(rows().length).toBe(3);
    const [first, second, third] = rows();
    expect(first.textContent).toContain('POL-001');
    expect(first.textContent).toContain('Política 1');
    expect(first.querySelector('[data-test-version]')!.textContent).toContain('DOCUMENTS.MINE.VERSION_NUMBER');
    expect(first.querySelector('[data-test-accepted]')!.textContent).toContain('DOCUMENTS.LIST.ACCEPTED_OF');
    expect(first.querySelector('[data-test-outstanding]')!.textContent).toContain('DOCUMENTS.LIST.OUTSTANDING');
    // sin versión vigente se dice, y sin asignar también
    expect(second.querySelector('[data-test-unpublished]')).not.toBeNull();
    expect(second.querySelector('[data-test-unassigned]')).not.toBeNull();
    // todos aceptaron: no hay pendientes que anunciar
    expect(third.querySelector('[data-test-outstanding]')).toBeNull();
  });

  it('shows no percentage anywhere: the counts come with their total', () => {
    setup();
    expect(el().textContent).not.toMatch(/\d\s?%/);
  });

  it('asks the server for the first page and sends the filters it is given, restarting from page 1', () => {
    setup();
    expect(lastCall()).toEqual({ page: 1, pageSize: 25, q: '', type: null, hasCurrentVersion: null });
    pickOption(el(), '[data-test-filter-type]', 'procedure', () => fixture.detectChanges());
    expect(lastCall()).toEqual(jasmine.objectContaining({ page: 1, type: 'procedure' }));
    pickOption(el(), '[data-test-filter-publication]', 'unpublished', () => fixture.detectChanges());
    expect(lastCall()).toEqual(jasmine.objectContaining({ type: 'procedure', hasCurrentVersion: false }));
    pickOption(el(), '[data-test-filter-publication]', 'published', () => fixture.detectChanges());
    expect(lastCall()).toEqual(jasmine.objectContaining({ hasCurrentVersion: true }));
  });

  it('builds the type filter from the catalog, not from a list of its own', () => {
    setup();
    expect(api.catalog).toHaveBeenCalledWith('document_type');
    expect(fixture.componentInstance.typeOptions().map((o) => o.label)).toEqual(['Política', 'Procedimiento']);
  });

  it('searches on the server after the person stops typing, not on every key', fakeAsync(() => {
    setup();
    const before = api.list.calls.count();
    search('p');
    search('po');
    search('pol-002');
    expect(api.list.calls.count()).toBe(before);
    tick(300);
    expect(api.list.calls.count()).toBe(before + 1);
    expect(lastCall()).toEqual(jasmine.objectContaining({ q: 'pol-002', page: 1 }));
  }));

  it('searches again for the same text after the filters were cleared', fakeAsync(() => {
    setup();
    search('abc');
    tick(300);
    const afterFirst = api.list.calls.count();
    expect(lastCall()).toEqual(jasmine.objectContaining({ q: 'abc' }));
    fixture.componentInstance.clearFilters();
    expect(lastCall()).toEqual(jasmine.objectContaining({ q: '' }));
    tick(300);
    const afterClear = api.list.calls.count();
    expect(afterClear).toBe(afterFirst + 1);
    search('abc');
    tick(300);
    expect(api.list.calls.count()).toBe(afterClear + 1);
    expect(lastCall()).toEqual(jasmine.objectContaining({ q: 'abc', page: 1 }));
  }));

  it('does not ask the server again when the text did not change', fakeAsync(() => {
    setup();
    search('abc');
    tick(300);
    const count = api.list.calls.count();
    search('abcd');
    search('abc');
    tick(300);
    expect(api.list.calls.count()).toBe(count);
  }));

  it('goes to another page and changes its size', () => {
    setup('admin_empresa', of(pageOf(ROWS, 60)));
    fixture.componentInstance.goTo(2);
    expect(lastCall()).toEqual(jasmine.objectContaining({ page: 2, pageSize: 25 }));
    fixture.componentInstance.resize(50);
    expect(lastCall()).toEqual(jasmine.objectContaining({ page: 1, pageSize: 50 }));
  });

  it('says what happened when the filters leave nothing, and clears them with a button', () => {
    setup();
    pickOption(el(), '[data-test-filter-type]', 'procedure', () => fixture.detectChanges());
    api.list.and.returnValue(of(pageOf([])));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el().querySelector('[data-test-empty]')!.textContent).toContain('DOCUMENTS.LIST.EMPTY_FILTERED_TITLE');
    api.list.and.returnValue(of(pageOf(ROWS)));
    el().querySelector<HTMLButtonElement>('[data-test-clear]')!.click();
    fixture.detectChanges();
    expect(lastCall()).toEqual({ page: 1, pageSize: 25, q: '', type: null, hasCurrentVersion: null });
  });

  it('explains an empty library instead of leaving the screen blank', () => {
    setup('admin_empresa', of(pageOf([])));
    expect(el().querySelector('[data-test-empty]')!.textContent).toContain('DOCUMENTS.LIST.EMPTY_TITLE');
    expect(el().querySelector('[data-test-empty]')!.textContent).toContain('DOCUMENTS.LIST.EMPTY_BODY');
  });

  it('shows an error with a retry that asks again', () => {
    setup('admin_empresa', throwError(() => new Error('500')));
    expect(el().querySelector('[data-test-error]')).not.toBeNull();
    api.list.and.returnValue(of(pageOf(ROWS)));
    el().querySelector<HTMLButtonElement>('[data-test-retry]')!.click();
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  describe('the detail panel (the document open goes in the address)', () => {
    it('opens it from the row with ?abrir=<id>, and closes it by taking the parameter away', () => {
      setup();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      (rows()[0] as HTMLElement).click();
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { abrir: '1' }, queryParamsHandling: 'merge' }));
      fixture.componentInstance.closeDetail();
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { abrir: null } }));
    });

    it('shows the panel of the document that the address names, with the administrator able to manage', () => {
      setup();
      query.next(convertToParamMap({ abrir: '1' }));
      fixture.detectChanges();
      expect(api.get).toHaveBeenCalledWith('1');
      expect(el().querySelector('app-document-detail-panel')).not.toBeNull();
      expect(fixture.componentInstance.canManage()).toBeTrue();
    });

    it('opens it read-only for the auditor', () => {
      setup('auditor');
      expect(fixture.componentInstance.canManage()).toBeFalse();
    });

    it('asks the list again when the panel says something changed, and closes it when the panel asks to close', () => {
      setup();
      query.next(convertToParamMap({ abrir: '1' }));
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.directive(DocumentDetailPanel)).componentInstance as DocumentDetailPanel;
      const before = api.list.calls.count();
      panel.changed.emit();
      expect(api.list.calls.count()).toBe(before + 1);
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      panel.closed.emit();
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { abrir: null } }));
    });
  });
});
