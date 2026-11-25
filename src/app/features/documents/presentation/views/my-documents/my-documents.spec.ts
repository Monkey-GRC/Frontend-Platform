import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { MyDocument } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { optionsText, pickOption } from '@shared/presentation/components/select/select.testing';
import { MyDocumentsView } from './my-documents';

const item = (id: string, over: Partial<MyDocument> = {}): MyDocument => ({
  document: { id, code: `POL-00${id}`, name: `Política ${id}`, type: 'policy' },
  version: { id: `v${id}`, number: 2, approved_at: '2026-11-01' },
  requires_acceptance: true,
  status: 'pending',
  assigned_at: '2026-11-10T10:00:00Z',
  due_at: '2026-11-20T10:00:00Z',
  accepted_at: null,
  ...over,
});
const ITEMS: MyDocument[] = [
  item('1', { status: 'overdue', due_at: '2026-11-15T10:00:00Z' }),
  item('2'),
  item('3', { status: 'accepted', accepted_at: '2026-11-12T10:00:00Z' }),
  item('4', { requires_acceptance: false }),
];

describe('MyDocumentsView (MD-503: «Mis documentos»)', () => {
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<MyDocumentsView>;

  function setup(mine = of(ITEMS)): void {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['mine', 'catalog']);
    api.mine.and.returnValue(mine);
    api.catalog.and.callFake((name) =>
      of(name === 'my_document_status' ? [{ value: 'pending', label: 'Por aceptar' }, { value: 'accepted', label: 'Aceptado' }, { value: 'overdue', label: 'Vencido' }] : [{ value: 'policy', label: 'Política' }]),
    );
    TestBed.configureTestingModule({ imports: [MyDocumentsView], providers: [provideTranslateService({ fallbackLang: 'es' }), provideRouter([]), { provide: DocumentService, useValue: api }] });
    fixture = TestBed.createComponent(MyDocumentsView);
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const search = (value: string) => {
    const input = el().querySelector<HTMLInputElement>('[data-search-input]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('shows the skeleton of the table while the list arrives, and never an empty state meanwhile', () => {
    setup(NEVER);
    expect(el().querySelector('[data-test-error]')).toBeNull();
    expect(el().textContent).not.toContain('DOCUMENTS.MINE.EMPTY_TITLE');
    expect(el().querySelector('app-skeleton, [data-skeleton]')).not.toBeNull();
  });

  it('lists each document with its code always visible, its version and its state with the date that goes with it', () => {
    setup();
    expect(rows().length).toBe(4);
    const [overdue, pending, accepted, readOnly] = rows();
    expect(overdue.textContent).toContain('POL-001');
    expect(overdue.textContent).toContain('Política 1');
    expect(overdue.textContent).toContain('Política'); // el tipo, del catálogo
    expect(overdue.querySelector('[data-status="overdue"]')).not.toBeNull();
    expect(overdue.textContent).toContain('DOCUMENTS.MINE.OVERDUE_SINCE');
    expect(overdue.textContent).toContain('DOCUMENTS.MINE.VERSION_NUMBER');
    expect(pending.querySelector('[data-status="pending"]')).not.toBeNull();
    expect(pending.textContent).toContain('DOCUMENTS.MINE.DUE_ON');
    expect(accepted.querySelector('[data-status="accepted"]')).not.toBeNull();
    expect(accepted.textContent).toContain('DOCUMENTS.MINE.ACCEPTED_ON');
    // un documento que no pide aceptación se lee, no se acepta: sin plazo
    expect(readOnly.querySelector('[data-status="not_required"]')).not.toBeNull();
    expect(readOnly.textContent).toContain('DOCUMENTS.MINE.READ_ONLY');
    expect(readOnly.textContent).not.toContain('DOCUMENTS.MINE.DUE_ON');
  });

  it('shows no percentage anywhere', () => {
    setup();
    expect(el().textContent).not.toMatch(/\d\s?%/);
  });

  it('links the name of each document to its reader, as underlined navigation', () => {
    setup();
    const link = el().querySelector<HTMLAnchorElement>('[data-test-read]')!;
    expect(link.getAttribute('href')).toBe('/mis-documentos/1');
    expect(link.className).toContain('underline');
  });

  it('opens the reader from the row too', () => {
    setup();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (rows()[1] as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/mis-documentos', '2']);
  });

  it('searches by code or name, and says what happened when nothing matches', () => {
    setup();
    search('pol-003');
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('POL-003');
    search('no existe');
    expect(el().textContent).toContain('DOCUMENTS.MINE.EMPTY_FILTERED_TITLE');
    el().querySelector<HTMLButtonElement>('[data-test-clear]')!.click();
    fixture.detectChanges();
    expect(rows().length).toBe(4);
  });

  it('filters by state, with the states and labels of the catalog (no list of its own)', () => {
    setup();
    expect(api.catalog).toHaveBeenCalledWith('my_document_status');
    expect(optionsText(el(), '[data-test-filter-status]', () => fixture.detectChanges())).toContain('Vencido');
    pickOption(el(), '[data-test-filter-status]', 'overdue', () => fixture.detectChanges());
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('POL-001');
  });

  it('tells a person with nothing assigned what will happen, instead of leaving the screen blank', () => {
    setup(of([]));
    expect(el().textContent).toContain('DOCUMENTS.MINE.EMPTY_TITLE');
    expect(el().textContent).toContain('DOCUMENTS.MINE.EMPTY_BODY');
  });

  it('shows the error with a retry that asks again', () => {
    setup(throwError(() => new Error('500')));
    expect(el().querySelector('[data-test-error]')).not.toBeNull();
    api.mine.and.returnValue(of(ITEMS));
    el().querySelector<HTMLButtonElement>('[data-test-retry]')!.click();
    fixture.detectChanges();
    expect(rows().length).toBe(4);
  });

  it('keeps showing the list when the catalog of types fails', () => {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['mine', 'catalog']);
    api.mine.and.returnValue(of(ITEMS));
    api.catalog.and.returnValue(throwError(() => new Error('500')));
    TestBed.configureTestingModule({ imports: [MyDocumentsView], providers: [provideTranslateService({ fallbackLang: 'es' }), provideRouter([]), { provide: DocumentService, useValue: api }] });
    fixture = TestBed.createComponent(MyDocumentsView);
    fixture.detectChanges();
    expect(rows().length).toBe(4);
  });
});
