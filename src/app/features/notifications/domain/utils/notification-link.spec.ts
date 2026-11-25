import { makeNotification } from '@features/notifications/testing/notification-fixtures';
import { groupedControlLinks, notificationLink } from './notification-link';

describe('notificationLink', () => {
  it('opens a control in Compliance → Controls with its service', () => {
    expect(notificationLink(makeNotification())).toEqual({ commands: ['/cumplimiento', 'controles'], queryParams: { abrir: 'ctl-1', servicio: 'svc-1' } });
  });

  it('leaves the service out when the notice has none', () => {
    const link = notificationLink(makeNotification({ target: { kind: 'control', id: 'ctl-1', service_id: null } }));
    expect(link?.queryParams).toEqual({ abrir: 'ctl-1' });
  });

  it('takes a grouped notice of a service to Assignment, filtered by «unassigned», with that service', () => {
    const link = notificationLink(makeNotification({ control: null, target: { kind: 'service', id: 'svc-2', service_id: 'svc-2' } }));
    expect(link).toEqual({ commands: ['/asignacion'], queryParams: { servicio: 'svc-2', asignacion: 'unassigned' } });
  });

  it('links each control code of a grouped notice to that control, in the service of the notice', () => {
    const grouped = makeNotification({
      control: null,
      service: { id: 'svc-2', name: 'Servicio B' },
      controls: [{ id: 'c-1', code: 'IAC-12' }, { id: 'c-2', code: 'CC-3' }],
      target: { kind: 'service', id: 'svc-2', service_id: 'svc-2' },
    });
    expect(groupedControlLinks(grouped).map((c) => [c.code, c.link.queryParams])).toEqual([
      ['IAC-12', { abrir: 'c-1', servicio: 'svc-2' }],
      ['CC-3', { abrir: 'c-2', servicio: 'svc-2' }],
    ]);
    expect(groupedControlLinks(makeNotification())).toEqual([]);
  });

  it('has no link for the targets that are still reserved', () => {
    expect(notificationLink(makeNotification({ target: { kind: 'document', id: 'd-1', service_id: null } }))).toBeNull();
    expect(notificationLink(makeNotification({ target: { kind: 'company', id: 'c-1', service_id: null } }))).toBeNull();
  });
});
