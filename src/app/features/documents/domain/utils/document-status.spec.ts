import { canReadInline, downloadFromUrl, isHttpUrl, myStatusTone, outstanding, todayIso } from './document-status';

describe('document-status', () => {
  it('gives each state its tone: pending warns, accepted is fine, overdue is bad', () => {
    expect(myStatusTone('pending')).toBe('warn');
    expect(myStatusTone('accepted')).toBe('ok');
    expect(myStatusTone('overdue')).toBe('bad');
  });

  it('counts what is still to be accepted: pending and overdue together, never the accepted', () => {
    expect(outstanding({ total: 6, accepted: 3, pending: 2, overdue: 1 })).toBe(3);
    expect(outstanding({ total: 0, accepted: 0, pending: 0, overdue: 0 })).toBe(0);
  });

  it('reads PDF and images on screen, and leaves a DOCX to be downloaded', () => {
    expect(canReadInline('application/pdf')).toBeTrue();
    expect(canReadInline('image/png')).toBeTrue();
    expect(canReadInline('image/jpeg')).toBeTrue();
    expect(canReadInline('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeFalse();
    expect(canReadInline(null)).toBeFalse();
    expect(canReadInline(undefined)).toBeFalse();
  });

  it('only lets http and https links reach the viewer', () => {
    expect(isHttpUrl('https://files.example/x?sig=1')).toBeTrue();
    expect(isHttpUrl('http://localhost:9000/x')).toBeTrue();
    for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'not a url', '']) expect(isHttpUrl(bad)).toBeFalse();
  });

  it('rejects plain http when insecure links are not allowed (production)', () => {
    expect(isHttpUrl('http://files.example/x', false)).toBeFalse();
    expect(isHttpUrl('https://files.example/x', false)).toBeTrue();
  });

  it('downloads with an anchor made on the spot and removes it, without opening a window', () => {
    const open = spyOn(window, 'open');
    let connectedOnClick = false;
    const click = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(() => {
      connectedOnClick = !!document.querySelector('a[href^="https://files.example/x.pdf"]');
    });
    downloadFromUrl('https://files.example/x.pdf?sig=1', 'politica.pdf');
    const anchor = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(anchor.href).toBe('https://files.example/x.pdf?sig=1');
    expect(anchor.download).toBe('politica.pdf');
    expect(connectedOnClick).toBeTrue();
    expect(anchor.isConnected).toBeFalse();
    expect(open).not.toHaveBeenCalled();
  });

  it('writes today as a calendar day with the local date', () => {
    expect(todayIso(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  });
});
