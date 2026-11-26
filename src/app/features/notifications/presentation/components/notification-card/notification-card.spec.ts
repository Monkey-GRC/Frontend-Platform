import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { makeNotification } from '@features/notifications/testing/notification-fixtures';
import { NotificationItem } from '@features/notifications/domain/models/notification.models';
import { NotificationLink } from '@features/notifications/domain/utils/notification-link';
import { NotificationCard } from './notification-card';

describe('NotificationCard', () => {
  let fixture: ComponentFixture<NotificationCard>;
  const q = (sel: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(sel);

  function setup(item: NotificationItem, link: NotificationLink | null = null, typeLabel: string | null = 'Ventana por vencer') {
    TestBed.configureTestingModule({ imports: [NotificationCard], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(NotificationCard);
    fixture.componentRef.setInput('notification', item);
    fixture.componentRef.setInput('typeLabel', typeLabel);
    fixture.componentRef.setInput('ago', 'hace 14 horas');
    fixture.componentRef.setInput('link', link);
    fixture.detectChanges();
  }

  it('shows the service and the time, the title without the control code, the short summary and the codes', () => {
    setup(makeNotification());
    expect(q('[data-testid="notice-meta"]')!.textContent).toContain('Plataforma de pagos');
    expect(q('[data-testid="notice-ago"]')!.textContent).toContain('hace 14 horas');
    expect(q('[data-testid="notice-ago"]')!.closest('article')!.querySelector('[data-testid="notice-meta"]')!.textContent).not.toContain('hace 14 horas');
    expect(q('[data-testid="notice-title"]')!.textContent).toContain('La ventana trimestral cierra');
    expect(q('[data-testid="notice-title"]')!.textContent).not.toContain('IAC-12');
    expect(q('[data-testid="notice-open"]')!.getAttribute('aria-describedby')).toBe(q('[data-testid="notice-title"]')!.id);
    expect(q('[data-testid="notice-summary"]')!.textContent).toContain('no tiene evidencia válida');
    expect(Array.from(fixture.nativeElement.querySelectorAll('app-tag')).map((t) => (t as HTMLElement).textContent!.trim())).toEqual(['IAC-12', 'CC6.1', 'CC6.2']);
  });

  it('marks the unread one with the dot, the weight and the words for a screen reader', () => {
    setup(makeNotification({ is_read: false }));
    expect(q('[data-testid="notice-card"]')!.getAttribute('data-unread')).toBe('true');
    expect(q('app-unread-dot')!.getAttribute('data-unread')).toBe('true');
    expect(q('[data-testid="notice-title"] .sr-only')!.textContent).toContain('NOTIFICATIONS.UNREAD');
    TestBed.resetTestingModule();
    setup(makeNotification({ is_read: true }));
    expect(q('[data-testid="notice-card"]')!.getAttribute('data-unread')).toBe('false');
  });

  it('names the icon with the type of the notice and gives each type its tone', () => {
    setup(makeNotification({ type: 'window_expired' }), null, 'Ventana vencida');
    expect(q('[data-testid="notice-icon"]')!.getAttribute('title')).toBe('Ventana vencida');
    expect(q('[data-testid="notice-icon"]')!.className).toContain('mk-metric-icon-bad');
  });

  it('a company notice has no service and no codes: it says «Empresa» and keeps the link', () => {
    setup(makeNotification({ control: null, controls: [], service: null, target: { kind: 'company', id: 'c', service_id: null } }));
    expect(q('[data-testid="notice-meta"]')!.textContent).toContain('NOTIFICATIONS.CARD.COMPANY');
    expect(fixture.nativeElement.querySelectorAll('app-tag').length).toBe(0);
    expect(q('[data-testid="notice-open"]')).not.toBeNull();
  });

  it('a grouped notice lists the codes of its controls', () => {
    setup(makeNotification({ control: null, controls: [{ id: 'a', code: 'IAC-01' }, { id: 'b', code: 'CRY-02' }], target: { kind: 'service', id: 'svc-1', service_id: 'svc-1' } }));
    expect(Array.from(fixture.nativeElement.querySelectorAll('app-tag')).map((t) => (t as HTMLElement).textContent!.trim())).toEqual(['IAC-01', 'CRY-02']);
  });

  it('a notice with many codes keeps the card whole: the first ones and «+N», with the rest in the tooltip', () => {
    const many = Array.from({ length: 10 }, (_, i) => `CC${i}.1`);
    setup(makeNotification({ control: { id: 'c', code: 'IAC-12', name: 'x', requirement_codes: many } }));
    expect(fixture.nativeElement.querySelectorAll('app-tag').length).toBe(4);
    const more = q('[data-testid="notice-more-codes"]')!;
    expect(more.getAttribute('title')).toContain('CC9.1');
    expect(more.textContent).toContain('NOTIFICATIONS.CARD.MORE_CODES');
  });

  it('«Ver detalles» is a router link with a route and a button without it; both tell the parent', () => {
    setup(makeNotification(), { commands: ['/cumplimiento/controles'], queryParams: { abrir: 'ctl-1' } });
    const link = q('[data-testid="notice-open"]') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toContain('abrir=ctl-1');
    TestBed.resetTestingModule();
    setup(makeNotification());
    const button = q('[data-testid="notice-open"]') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    let emitted = 0;
    fixture.componentInstance.opened.subscribe(() => emitted++);
    button.click();
    expect(emitted).toBe(1);
  });
});
