import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { makeNotification } from '@features/notifications/testing/notification-fixtures';
import { NotificationItem } from '@features/notifications/domain/models/notification.models';
import { NotificationDetailPanel } from './notification-detail';

describe('NotificationDetailPanel', () => {
  let fixture: ComponentFixture<NotificationDetailPanel>;
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));

  function setup(notification: NotificationItem = makeNotification()) {
    TestBed.configureTestingModule({ imports: [NotificationDetailPanel], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(NotificationDetailPanel);
    fixture.componentRef.setInput('notification', notification);
    fixture.componentRef.setInput('typeLabel', 'Ventana por vencer');
    fixture.detectChanges();
  }

  it('is the narrow side panel with the title of the notice, the requirement codes and the control code linked to it', () => {
    setup();
    expect(q('[data-detail-title]')!.textContent).toContain('IAC-12 ·');
    expect(q('[data-testid="notification-detail-dialog"]')!.getAttribute('data-size')).toBe('drawer-narrow');
    const codes = qa('app-tag').map((t) => t.textContent!.trim());
    expect(codes).toEqual(['CC6.1', 'CC6.2', 'IAC-12']);
    const chip = q('[data-testid="detail-control-chip"]') as HTMLAnchorElement;
    expect(chip.getAttribute('href')).toContain('abrir=ctl-1');
    expect(chip.textContent).toContain('Revisión de accesos privilegiados');
  });

  it('puts the service, the type, when it arrived, the window and the state in the strip on top', () => {
    setup();
    const strip = q('[data-testid="detail-context"]')!.textContent!;
    expect(strip).toContain('Plataforma de pagos');
    expect(strip).toContain('Ventana por vencer');
    expect(strip).toContain('NOTIFICATIONS.DETAIL.DUE');
    expect(q('[data-testid="detail-state"]')!.textContent).toContain('NOTIFICATIONS.UNREAD');
  });

  it('shows the seven fields of the template, in order', () => {
    setup();
    const fields = qa('[data-field]').map((s) => s.getAttribute('data-field'));
    expect(fields).toEqual(['what_happened', 'how_to_fix', 'why_it_matters', 'who', 'time_needed', 'evidence', 'impact']);
    expect(q('[data-testid="detail-what"]')!.textContent).toContain('no tiene evidencia válida');
    expect(q('[data-field="how_to_fix"]')!.textContent).toContain('Sube la evidencia');
    expect(q('[data-testid="detail-facts"]')!.querySelectorAll('[data-field]').length).toBe(5);
  });

  it('leaves out the fields that come null, with no gap', () => {
    const base = makeNotification();
    setup({ ...base, detail: { ...base.detail, why_it_matters: null, who: null, impact: '  ' } });
    const fields = qa('[data-field]').map((s) => s.getAttribute('data-field'));
    expect(fields).toEqual(['what_happened', 'how_to_fix', 'time_needed', 'evidence']);
  });

  it('says so when there is no detail at all', () => {
    const base = makeNotification();
    const empty = Object.fromEntries(Object.keys(base.detail).map((k) => [k, null])) as unknown as NotificationItem['detail'];
    setup({ ...base, detail: empty });
    expect(q('[data-testid="detail-empty"]')).not.toBeNull();
    expect(qa('[data-field]').length).toBe(0);
  });

  it('«Cómo corregirlo» carries the button with text that opens the control, and tells the parent it was followed', () => {
    setup();
    let followed = 0;
    fixture.componentInstance.followed.subscribe(() => followed++);
    const link = q('[data-testid="detail-open-target"]') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.textContent).toContain('NOTIFICATIONS.DETAIL.OPEN_CONTROL');
    expect(q('[data-testid="detail-fix"]')!.contains(link)).toBeTrue();
    expect(link.getAttribute('href')).toContain('abrir=ctl-1');
    link.click();
    expect(followed).toBe(1);
  });

  it('a grouped notice of a service (no control) offers «Asignar los controles sin dueño», which goes to Assignment filtered by unassigned', () => {
    setup(makeNotification({ control: null, due_at: null, target: { kind: 'service', id: 'svc-2', service_id: 'svc-2' } }));
    const link = q('[data-testid="detail-open-target"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('NOTIFICATIONS.DETAIL.ASSIGN_UNOWNED');
    const href = link.getAttribute('href')!;
    expect(href).toContain('/asignacion');
    expect(href).toContain('servicio=svc-2');
    expect(href).toContain('asignacion=unassigned');
    expect(q('[data-testid="detail-control-chip"]')).toBeNull();
    expect(qa('app-tag').length).toBe(0);
  });

  it('shows the codes of a grouped notice as chips linked to each control', () => {
    setup(makeNotification({
      control: null,
      due_at: null,
      controls: [{ id: 'c-1', code: 'IAC-12' }, { id: 'c-2', code: 'CC-3' }],
      target: { kind: 'service', id: 'svc-2', service_id: 'svc-2' },
    }));
    const chips = qa('[data-testid="detail-control-code"]') as HTMLAnchorElement[];
    expect(chips.map((c) => c.textContent!.trim())).toEqual(['IAC-12', 'CC-3']);
    expect(chips[0].getAttribute('href')).toContain('abrir=c-1');
    expect(chips[0].getAttribute('href')).toContain('servicio=svc-1');
  });

  it('shows no code chips when the notice has no grouped controls', () => {
    setup();
    expect(q('[data-testid="detail-controls"]')).toBeNull();
  });

  it('has no link for a target that is still reserved', () => {
    setup(makeNotification({ target: { kind: 'document', id: 'd-1', service_id: null } }));
    expect(q('[data-testid="detail-open-target"]')).toBeNull();
  });

  it('marks read or unread with a button that has text', () => {
    setup();
    const events: boolean[] = [];
    fixture.componentInstance.readChange.subscribe((v) => events.push(v));
    const button = q('[data-testid="detail-toggle-read"]') as HTMLButtonElement;
    expect(button.textContent).toContain('NOTIFICATIONS.DETAIL.MARK_READ');
    button.click();
    fixture.componentRef.setInput('notification', makeNotification({ is_read: true }));
    fixture.detectChanges();
    expect(button.textContent).toContain('NOTIFICATIONS.DETAIL.MARK_UNREAD');
    button.click();
    expect(events).toEqual([true, false]);
  });

  it('emits closed from «Cerrar»', () => {
    setup();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    (q('[data-detail-close]') as HTMLButtonElement).click();
    expect(closed).toBe(1);
  });
});
