import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, NEVER, Subject, of, throwError } from 'rxjs';
import { DocumentFileLink, MyDocument } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { DocumentReaderView } from './document-reader';

const mine = (over: Partial<MyDocument> = {}): MyDocument => ({
  document: { id: 'd1', code: 'POL-001', name: 'Política de control de accesos', type: 'policy' },
  version: { id: 'v2', number: 2, approved_at: '2026-11-01' },
  requires_acceptance: true,
  status: 'pending',
  assigned_at: '2026-11-10T10:00:00Z',
  due_at: '2026-11-20T10:00:00Z',
  accepted_at: null,
  ...over,
});
const pdf = (over: Partial<DocumentFileLink> = {}): DocumentFileLink => ({ url: 'https://files.example/x?sig=1', file_name: 'politica.pdf', file_type: 'application/pdf', disposition: 'inline', expires_in: 300, ...over });
const http = (status: number, code: string, message = 'Mensaje del servidor') => new HttpErrorResponse({ status, error: { message, error: { code } } });
const notInline = () => new HttpErrorResponse({ status: 422, error: { message: 'x', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'disposition', code: 'disposition.not_inline', message: 'x' }] } } });

describe('DocumentReaderView (MD-503: leer y aceptar)', () => {
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<DocumentReaderView>;

  function setup(items = of([mine()]), inline = of(pdf()), id = 'd1'): void {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['mine', 'fileLink', 'accept']);
    api.mine.and.returnValue(items);
    api.fileLink.and.returnValue(inline);
    TestBed.configureTestingModule({
      imports: [DocumentReaderView],
      providers: [
        provideTranslateService({ fallbackLang: 'es' }),
        provideRouter([]),
        { provide: DocumentService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id })) } },
      ],
    });
    fixture = TestBed.createComponent(DocumentReaderView);
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const click = (s: string) => {
    q<HTMLElement>(s)!.click();
    fixture.detectChanges();
  };
  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

  it('shows the skeleton with the shape of the reader while the document arrives', () => {
    setup(NEVER);
    expect(q('[data-test-loading]')).not.toBeNull();
    expect(q('[data-test-accept]')).toBeNull();
  });

  describe('the file', () => {
    it('asks for the signed link to read the current version and shows the PDF in the page, with the code and the version always visible', () => {
      setup();
      expect(api.fileLink).toHaveBeenCalledOnceWith('d1', 'v2', 'inline');
      expect(q('[data-test-meta]')!.textContent).toContain('POL-001');
      expect(q('[data-test-meta]')!.textContent).toContain('DOCUMENTS.MINE.VERSION_NUMBER');
      expect(q('h1')!.textContent).toContain('Política de control de accesos');
      expect(q<HTMLIFrameElement>('[data-test-pdf]')).not.toBeNull();
      expect(q('[data-test-viewer]')!.getAttribute('data-viewer')).toBe('inline');
    });

    it('shows an image in the page too', () => {
      setup(undefined, of(pdf({ file_type: 'image/png', file_name: 'acta.png' })));
      expect(q('[data-test-image]')).not.toBeNull();
      expect(q('[data-test-pdf]')).toBeNull();
    });

    it('leaves a DOCX to be downloaded (422 disposition.not_inline) and downloads it with a new link through a download anchor', () => {
      setup(undefined, throwError(() => notInline()));
      expect(q('[data-test-download-only]')).not.toBeNull();
      const open = spyOn(window, 'open');
      const clicked: HTMLAnchorElement[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
      api.fileLink.and.returnValue(of(pdf({ url: 'https://files.example/x.docx?sig=2', disposition: 'attachment' })));
      click('[data-test-download]');
      expect(api.fileLink).toHaveBeenCalledWith('d1', 'v2', 'attachment');
      expect(clicked.length).toBe(1);
      expect(clicked[0].href).toBe('https://files.example/x.docx?sig=2');
      expect(open).not.toHaveBeenCalled();
    });

    it('never puts a link that is not http(s) into the viewer', () => {
      setup(undefined, of(pdf({ url: 'javascript:alert(1)' })));
      expect(q('[data-test-pdf]')).toBeNull();
      expect(q('[data-test-viewer-error]')).not.toBeNull();
    });

    it('says so when the file cannot be opened, and tries again with a new link', () => {
      setup(undefined, throwError(() => new HttpErrorResponse({ status: 500 })));
      expect(q('[data-test-viewer-error]')).not.toBeNull();
      api.fileLink.and.returnValue(of(pdf()));
      click('[data-test-reopen]');
      expect(q('[data-test-pdf]')).not.toBeNull();
    });

    it('does not download with a link that is not http(s), and says it', () => {
      setup();
      api.fileLink.and.returnValue(of(pdf({ url: 'data:text/html,x' })));
      const anchorClick = spyOn(HTMLAnchorElement.prototype, 'click');
      click('[data-test-refresh] + button');
      expect(anchorClick).not.toHaveBeenCalled();
      expect(q('[data-test-download-error]')).not.toBeNull();
    });
  });

  describe('accepting', () => {
    it('asks for confirmation naming the code and the version, and accepts the version that was seen', () => {
      setup();
      expect(q('[data-test-deadline]')!.textContent).toContain('DOCUMENTS.MINE.DUE_ON');
      click('[data-test-accept]');
      expect(q('app-confirm-dialog')).not.toBeNull();
      expect(api.accept).not.toHaveBeenCalled();
      api.accept.and.returnValue(of({ id: 'a1', document_id: 'd1', version: { id: 'v2', number: 2 }, accepted_at: '2026-11-24T10:00:00Z', integrity_hash: 'abc' }));
      api.mine.and.returnValue(of([mine({ status: 'accepted', accepted_at: '2026-11-24T10:00:00Z' })]));
      fixture.componentInstance.confirm();
      fixture.detectChanges();
      expect(api.accept).toHaveBeenCalledOnceWith('d1', 'v2');
      expect(toasts()).toContain('DOCUMENTS.READER.ACCEPTED_TOAST');
      expect(q('[data-test-accepted]')).not.toBeNull();
      expect(q('[data-test-accept]')).toBeNull();
      expect(q('app-confirm-dialog')).toBeNull();
    });

    it('does not accept if the person cancels', () => {
      setup();
      click('[data-test-accept]');
      fixture.componentInstance.confirming.set(false);
      fixture.detectChanges();
      expect(api.accept).not.toHaveBeenCalled();
    });

    it('explains that a new version was published while reading (409) and offers to load it', () => {
      setup();
      click('[data-test-accept]');
      api.accept.and.returnValue(throwError(() => http(409, 'DOCUMENT_VERSION_NOT_CURRENT')));
      fixture.componentInstance.confirm();
      fixture.detectChanges();
      expect(q('[data-test-problem]')!.textContent).toContain('DOCUMENTS.READER.ERROR.NOT_CURRENT');
      api.mine.and.returnValue(of([mine({ version: { id: 'v3', number: 3, approved_at: '2026-11-22' } })]));
      click('[data-test-reload]');
      expect(api.fileLink).toHaveBeenCalledWith('d1', 'v3', 'inline');
      expect(q('[data-test-problem]')).toBeNull();
    });

    it('explains each of the other refusals in its own words', () => {
      const cases: [HttpErrorResponse, string, boolean][] = [
        [http(409, 'DOCUMENT_ALREADY_ACCEPTED'), 'DOCUMENTS.READER.ERROR.ALREADY_ACCEPTED', true],
        [http(409, 'DOCUMENT_ACCEPTANCE_NOT_REQUIRED'), 'DOCUMENTS.READER.ERROR.NOT_REQUIRED', true],
        [http(403, 'FORBIDDEN'), 'DOCUMENTS.READER.ERROR.NOT_ASSIGNED', false],
      ];
      for (const [error, text, reload] of cases) {
        TestBed.resetTestingModule();
        setup();
        click('[data-test-accept]');
        api.accept.and.returnValue(throwError(() => error));
        fixture.componentInstance.confirm();
        fixture.detectChanges();
        expect(q('[data-test-problem]')!.textContent).toContain(text);
        expect(!!q('[data-test-reload]')).toBe(reload);
      }
    });

    it('shows the message of the server when the error has no text of its own', () => {
      setup();
      click('[data-test-accept]');
      api.accept.and.returnValue(throwError(() => http(500, 'INTERNAL', 'Algo falló en el servidor')));
      fixture.componentInstance.confirm();
      fixture.detectChanges();
      expect(q('[data-test-problem]')!.textContent).toContain('Algo falló en el servidor');
    });

    it('lets an overdue document be accepted anyway, saying it will be recorded as late', () => {
      setup(of([mine({ status: 'overdue' })]));
      expect(q('[data-test-deadline]')!.textContent).toContain('DOCUMENTS.MINE.OVERDUE_SINCE');
      expect(q('[data-test-accept-card]')!.textContent).toContain('DOCUMENTS.READER.ACCEPT_LATE');
      expect(q('[data-test-accept]')).not.toBeNull();
    });

    it('offers nothing to accept when it is already accepted, or when it does not require acceptance', () => {
      setup(of([mine({ status: 'accepted', accepted_at: '2026-11-12T10:00:00Z' })]));
      expect(q('[data-test-accept]')).toBeNull();
      expect(q('[data-test-accepted]')!.textContent).toContain('DOCUMENTS.READER.ACCEPTED_BODY');
      TestBed.resetTestingModule();
      setup(of([mine({ requires_acceptance: false })]));
      expect(q('[data-test-accept]')).toBeNull();
      expect(q('[data-test-not-required]')).not.toBeNull();
    });
  });

  it('drops the answer of the previous document when the person moves to another one', () => {
    const first = new Subject<MyDocument[]>();
    const second = new Subject<MyDocument[]>();
    const params = new BehaviorSubject(convertToParamMap({ id: 'd1' }));
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['mine', 'fileLink', 'accept']);
    api.mine.and.returnValues(first, second);
    api.fileLink.and.returnValue(of(pdf()));
    TestBed.configureTestingModule({
      imports: [DocumentReaderView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), provideRouter([]), { provide: DocumentService, useValue: api }, { provide: ActivatedRoute, useValue: { paramMap: params } }],
    });
    fixture = TestBed.createComponent(DocumentReaderView);
    fixture.detectChanges();
    params.next(convertToParamMap({ id: 'd2' }));
    fixture.detectChanges();
    first.next([mine()]);
    first.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.item()).toBeNull();
    expect(api.fileLink).not.toHaveBeenCalled();
    second.next([mine({ document: { id: 'd2', code: 'POL-002', name: 'Otra', type: 'policy' }, version: { id: 'v9', number: 1, approved_at: '2026-11-01' } })]);
    second.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.item()?.document.id).toBe('d2');
    expect(api.fileLink).toHaveBeenCalledOnceWith('d2', 'v9', 'inline');
  });

  it('keeps showing the document when asking again for its new state fails after accepting', () => {
    setup();
    click('[data-test-accept]');
    api.accept.and.returnValue(of({ id: 'a1', document_id: 'd1', version: { id: 'v2', number: 2 }, accepted_at: '2026-11-24T10:00:00Z', integrity_hash: 'abc' }));
    api.mine.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.confirm();
    fixture.detectChanges();
    expect(toasts()).toContain('DOCUMENTS.READER.ACCEPTED_TOAST');
    expect(fixture.componentInstance.item()?.status).toBe('pending');
    expect(q('[data-test-meta]')).not.toBeNull();
    expect(q('[data-test-error]')).toBeNull();
  });

  it('says the document is not assigned to the person (a link that is not theirs) instead of leaving a blank page', () => {
    setup(of([mine()]), of(pdf()), 'otro');
    expect(q('[data-test-missing]')).not.toBeNull();
    expect(api.fileLink).not.toHaveBeenCalled();
  });

  it('shows the error with a retry that asks again', () => {
    setup(throwError(() => new Error('500')));
    expect(q('[data-test-error]')).not.toBeNull();
    api.mine.and.returnValue(of([mine()]));
    click('[data-test-retry]');
    expect(q('[data-test-meta]')).not.toBeNull();
  });
});
