import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { TeamService } from '@shared/domain/services/team.service';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { DocumentDetail, DocumentFileLink, DocumentVersion } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { AssignPeopleForm } from '../assign-people-form/assign-people-form';
import { PublishVersionForm } from '../publish-version-form/publish-version-form';
import { DocumentDetailPanel } from './document-detail-panel';

const HASH = 'a3f5c9d2e1b04f6a8c7d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d';
const version = (number: number, over: Partial<DocumentVersion> = {}): DocumentVersion => ({
  id: `v${number}`,
  number,
  status: 'archived',
  approved_at: '2026-10-01',
  is_imported_approval: true,
  imported_approval: { approvers: [{ name: 'Ana Ruiz', role_label: 'Gerente general' }], approved_at: '2026-10-01', note: 'Acta 4' },
  file_name: `politica-v${number}.pdf`,
  file_type: 'application/pdf',
  file_size: 2048,
  integrity_hash: HASH,
  created_at: '2026-10-02T10:00:00Z',
  ...over,
});
const DETAIL: DocumentDetail = {
  id: 'd1',
  code: 'POL-001',
  name: 'Política de control de accesos',
  type: 'policy',
  origin: 'internal',
  acceptance: 'users_who_apply',
  current_version: { id: 'v2', number: 2, approved_at: '2026-11-01', is_imported_approval: true, file_name: 'politica-v2.pdf', file_type: 'application/pdf' },
  assignments: { total: 3, accepted: 1, pending: 1, overdue: 1 },
  description: 'Define quién accede a qué.',
  minimum_content: 'Objetivo, alcance y responsables.',
  versions: [version(2, { status: 'current', approved_at: '2026-11-01' }), version(1)],
  assignees: [
    { user: { id: 'u1', name: 'Coco', last_name: 'Lara', role: 'colaborador' }, assigned_at: '2026-11-02T10:00:00Z', due_at: '2026-11-12T10:00:00Z', status: 'accepted', accepted_version_number: 2, accepted_at: '2026-11-03T10:00:00Z' },
    { user: { id: 'u2', name: 'Dani', last_name: 'Ruiz', role: 'delegado' }, assigned_at: '2026-11-02T10:00:00Z', due_at: '2026-12-02T10:00:00Z', status: 'pending', accepted_version_number: 1, accepted_at: '2026-10-05T10:00:00Z' },
    { user: { id: 'u3', name: 'Pedro', last_name: 'Gil', role: 'responsable' }, assigned_at: '2026-11-02T10:00:00Z', due_at: '2026-11-10T10:00:00Z', status: 'overdue', accepted_version_number: null, accepted_at: null },
  ],
};
const UNPUBLISHED: DocumentDetail = { ...DETAIL, current_version: null, versions: [], assignees: [], assignments: { total: 0, accepted: 0, pending: 0, overdue: 0 } };
const link = (over: Partial<DocumentFileLink> = {}): DocumentFileLink => ({ url: 'https://files.example/x?sig=1', file_name: 'a.pdf', file_type: 'application/pdf', disposition: 'attachment', expires_in: 300, ...over });

describe('DocumentDetailPanel (MD-503)', () => {
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<DocumentDetailPanel>;
  let panel: DocumentDetailPanel;

  function setup(canManage = true, detail = of(DETAIL)): void {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['get', 'catalog', 'fileLink']);
    api.get.and.returnValue(detail);
    api.catalog.and.callFake((name) => of(name === 'document_type' ? [{ value: 'policy', label: 'Política' }] : [{ value: 'users_who_apply', label: 'Usuarios que lo aplican' }]));
    const team = jasmine.createSpyObj<TeamService>('TeamService', ['listAll']);
    team.listAll.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [DocumentDetailPanel],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: DocumentService, useValue: api }, { provide: TeamService, useValue: team }],
    });
    fixture = TestBed.createComponent(DocumentDetailPanel);
    fixture.componentRef.setInput('documentId', 'd1');
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    panel = fixture.componentInstance;
  }
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => root().querySelector<T>(s);
  const tab = (id: string) => q(`[data-tab="${id}"]`)!;
  const goTo = (id: string) => {
    q<HTMLElement>(`#detail-tab-${id}`)!.click();
    fixture.detectChanges();
  };
  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

  it('shows the skeleton with the shape of the detail while it loads', () => {
    setup(true, NEVER);
    expect(q('[data-test-loading]')).not.toBeNull();
    expect(q('[data-detail-loading]')).not.toBeNull(); // la cabecera, con la forma de su título y sus códigos
  });

  it('shows the error with a retry that asks again', () => {
    setup(true, throwError(() => new Error('500')));
    expect(q('[data-test-error]')).not.toBeNull();
    api.get.and.returnValue(of(DETAIL));
    q<HTMLButtonElement>('[data-test-retry]')!.click();
    fixture.detectChanges();
    expect(q('[data-tab="summary"]')).not.toBeNull();
  });

  describe('the summary', () => {
    it('names the document with its code, type and current version in the header', () => {
      setup();
      expect(q('[data-detail-title]')!.textContent).toContain('Política de control de accesos');
      const meta = q('[meta]') ?? root();
      expect(meta.textContent).toContain('POL-001');
      expect(meta.textContent).toContain('Política');
      expect(q('[data-test-current-badge]')!.textContent).toContain('DOCUMENTS.DETAIL.CURRENT_BADGE');
    });

    it('explains what it is, what content it must have and who must accept it', () => {
      setup();
      expect(tab('summary').textContent).toContain('Define quién accede a qué.');
      expect(q('[data-test-minimum]')!.textContent).toContain('Objetivo, alcance y responsables.');
      expect(q('[data-test-rule]')!.textContent).toContain('DOCUMENTS.DETAIL.RULE');
    });

    it('counts the people with their total and never gives a percentage alone', () => {
      setup();
      const counts = q('[data-test-counts]')!.textContent!.replace(/\s+/g, ' ');
      expect(counts).toContain('3');
      expect(counts).toContain('DOCUMENTS.DETAIL.COUNTS.OF');
      expect(root().textContent).not.toMatch(/\d\s?%/);
    });

    it('says when there is no current version yet, and for the administrator what to do', () => {
      setup(true, of(UNPUBLISHED));
      expect(q('[data-test-unpublished]')!.textContent).toContain('DOCUMENTS.DETAIL.UNPUBLISHED_ADMIN');
      expect(q('[data-test-current-badge]')!.textContent).toContain('DOCUMENTS.LIST.UNPUBLISHED');
      expect(q<HTMLButtonElement>('[data-test-open-assign]')!.disabled).toBeTrue();
      expect(q('[data-test-open-assign]')!.getAttribute('title')).toContain('DOCUMENTS.DETAIL.ASSIGN_NEEDS_VERSION');
    });
  });

  describe('versions', () => {
    it('lists every version with who approved it, the note, the file and a shortened fingerprint', () => {
      setup();
      goTo('versions');
      const rows = Array.from(tab('versions').querySelectorAll('tbody tr'));
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('DOCUMENTS.VERSION_STATUS.CURRENT');
      expect(rows[1].textContent).toContain('DOCUMENTS.VERSION_STATUS.ARCHIVED');
      expect(rows[0].querySelector('[data-test-approvers]')!.textContent).toContain('Ana Ruiz · Gerente general');
      expect(rows[0].textContent).toContain('DOCUMENTS.DETAIL.NOTE');
      expect(rows[0].textContent).toContain('politica-v2.pdf');
      expect(rows[0].querySelector('[data-test-hash]')!.getAttribute('title')).toBe(HASH);
      expect(rows[0].querySelector('[data-test-hash]')!.textContent).not.toContain(HASH);
    });

    it('downloads a version with a signed link through a download anchor, not a window opened inside the response', () => {
      setup();
      goTo('versions');
      api.fileLink.and.returnValue(of(link()));
      const open = spyOn(window, 'open');
      const clicked: HTMLAnchorElement[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
      tab('versions').querySelector<HTMLButtonElement>('[data-test-download]')!.click();
      expect(api.fileLink).toHaveBeenCalledWith('d1', 'v2', 'attachment');
      expect(clicked.length).toBe(1);
      expect(clicked[0].href).toBe('https://files.example/x?sig=1');
      expect(open).not.toHaveBeenCalled();
    });

    it('does not open a link that is not http(s), and says so', () => {
      setup();
      goTo('versions');
      api.fileLink.and.returnValue(of(link({ url: 'javascript:alert(1)' })));
      const click = spyOn(HTMLAnchorElement.prototype, 'click');
      tab('versions').querySelector<HTMLButtonElement>('[data-test-download]')!.click();
      fixture.detectChanges();
      expect(click).not.toHaveBeenCalled();
      expect(q('[data-test-detail-error]')).not.toBeNull();
    });

    it('shows the message of the server when the download fails', () => {
      setup();
      goTo('versions');
      api.fileLink.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { message: 'El almacenamiento no está disponible.' } })));
      tab('versions').querySelector<HTMLButtonElement>('[data-test-download]')!.click();
      fixture.detectChanges();
      expect(q('[data-test-detail-error]')!.textContent).toContain('El almacenamiento no está disponible.');
    });

    it('says there are no versions yet instead of leaving the table blank', () => {
      setup(true, of(UNPUBLISHED));
      goTo('versions');
      expect(tab('versions').textContent).toContain('DOCUMENTS.DETAIL.VERSIONS.EMPTY_TITLE');
      expect(tab('versions').textContent).toContain('DOCUMENTS.DETAIL.VERSIONS.EMPTY_BODY');
    });
  });

  describe('people', () => {
    it('shows each person with their state and the date that goes with it', () => {
      setup();
      goTo('people');
      const rows = Array.from(tab('people').querySelectorAll('tbody tr'));
      expect(rows.length).toBe(3);
      expect(rows[0].querySelector('[data-status="accepted"]')).not.toBeNull();
      expect(rows[0].textContent).toContain('DOCUMENTS.DETAIL.PEOPLE.ACCEPTED');
      expect(rows[1].querySelector('[data-status="pending"]')).not.toBeNull();
      expect(rows[1].textContent).toContain('DOCUMENTS.MINE.DUE_ON');
      expect(rows[2].querySelector('[data-status="overdue"]')).not.toBeNull();
      expect(rows[2].textContent).toContain('DOCUMENTS.DETAIL.PEOPLE.NOT_ACCEPTED');
      expect(rows[2].textContent).toContain('DOCUMENTS.MINE.OVERDUE_SINCE');
    });

    it('searches by name', () => {
      setup();
      goTo('people');
      const input = tab('people').querySelector<HTMLInputElement>('[data-search-input]')!;
      input.value = 'pedro';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(tab('people').querySelectorAll('tbody tr').length).toBe(1);
    });

    it('invites the administrator to assign when nobody has it, and tells the auditor who does that', () => {
      setup(true, of({ ...UNPUBLISHED, current_version: DETAIL.current_version }));
      goTo('people');
      expect(tab('people').textContent).toContain('DOCUMENTS.DETAIL.PEOPLE.EMPTY_BODY_ADMIN');
      TestBed.resetTestingModule();
      setup(false, of({ ...UNPUBLISHED, current_version: DETAIL.current_version }));
      goTo('people');
      expect(tab('people').textContent).toContain('DOCUMENTS.DETAIL.PEOPLE.EMPTY_BODY');
      expect(tab('people').textContent).not.toContain('EMPTY_BODY_ADMIN');
    });
  });

  describe('who can act', () => {
    it('gives the administrator the two actions as buttons with text', () => {
      setup(true);
      expect(q('[data-test-open-publish]')!.textContent).toContain('DOCUMENTS.DETAIL.PUBLISH');
      expect(q('[data-test-open-assign]')!.textContent).toContain('DOCUMENTS.DETAIL.ASSIGN');
      expect(q<HTMLButtonElement>('[data-test-open-assign]')!.disabled).toBeFalse();
    });

    it('leaves the auditor with no action: read only', () => {
      setup(false);
      expect(q('[data-test-open-publish]')).toBeNull();
      expect(q('[data-test-open-assign]')).toBeNull();
      expect(root().querySelector('app-form-modal')).toBeNull();
    });
  });

  describe('publishing and assigning', () => {
    it('opens the publish form with how many people will have to accept again, and refreshes the detail and tells the list when it is done', () => {
      setup();
      const changed = jasmine.createSpy('changed');
      panel.changed.subscribe(changed);
      q<HTMLButtonElement>('[data-test-open-publish]')!.click();
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(PublishVersionForm)).componentInstance as PublishVersionForm;
      expect(form.assignedCount()).toBe(3);
      expect(form.documentId()).toBe('d1');
      api.get.and.returnValue(of({ ...DETAIL, versions: [version(3, { status: 'current' }), ...DETAIL.versions] }));
      form.published.emit(version(3));
      fixture.detectChanges();
      expect(panel.publishOpen()).toBeFalse();
      expect(toasts()).toContain('DOCUMENTS.PUBLISH.DONE');
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(panel.versions().length).toBe(3);
    });

    it('opens the assign form without offering again who already has it, and refreshes and tells the list when it is done', () => {
      setup();
      const changed = jasmine.createSpy('changed');
      panel.changed.subscribe(changed);
      q<HTMLButtonElement>('[data-test-open-assign]')!.click();
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(AssignPeopleForm)).componentInstance as AssignPeopleForm;
      expect(form.assignedUserIds()).toEqual(['u1', 'u2', 'u3']);
      form.assigned.emit(2);
      fixture.detectChanges();
      expect(panel.assignOpen()).toBeFalse();
      expect(toasts()).toContain('DOCUMENTS.ASSIGN.DONE');
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('closes the form without calling anything when the person cancels', () => {
      setup();
      q<HTMLButtonElement>('[data-test-open-publish]')!.click();
      fixture.detectChanges();
      panel.publishOpen.set(false);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.directive(PublishVersionForm))).toBeNull();
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  it('starts again at the summary when another document is opened', () => {
    setup();
    goTo('people');
    fixture.componentRef.setInput('documentId', 'd2');
    fixture.detectChanges();
    expect(panel.tab()).toBe('summary');
    expect(api.get).toHaveBeenCalledWith('d2');
  });

  it('closes by telling the list', () => {
    setup();
    const closed = jasmine.createSpy('closed');
    panel.closed.subscribe(closed);
    q<HTMLButtonElement>('[data-detail-x]')!.click();
    fixture.detectChanges();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
