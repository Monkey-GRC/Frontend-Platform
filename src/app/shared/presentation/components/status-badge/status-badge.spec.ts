import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  let fixture: ComponentFixture<StatusBadge>;

  const render = (status: unknown) => {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-status]') as HTMLElement;
    return { el, level: el.dataset['status'], icon: el.querySelector('.material-symbols-rounded')!.textContent!.trim(), classes: el.className, text: el.textContent!.trim() };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatusBadge], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(StatusBadge);
  });

  it('shows the four levels with their own label key', () => {
    expect(render('ready').text).toContain('COMPLIANCE.STATUS.READY');
    expect(render('almost_ready').text).toContain('COMPLIANCE.STATUS.ALMOST_READY');
    expect(render('needs_work').text).toContain('COMPLIANCE.STATUS.NEEDS_WORK');
    expect(render('not_measured').text).toContain('COMPLIANCE.STATUS.NOT_MEASURED');
  });

  it('paints «Sin medir» differently from «Requiere trabajo» (icon, border and color)', () => {
    const needsWork = render('needs_work');
    const notMeasured = render('not_measured');
    expect(notMeasured.icon).not.toBe(needsWork.icon);
    expect(notMeasured.classes).not.toBe(needsWork.classes);
    expect(notMeasured.classes).toContain('border-dashed');
    // «Sin medir» nunca usa los colores de un fallo.
    expect(notMeasured.classes).not.toMatch(/red|error/);
  });

  it('treats an unknown or empty value as «Sin medir», never as a failure', () => {
    expect(render('something_new').level).toBe('not_measured');
    expect(render(null).level).toBe('not_measured');
    expect(render(undefined).level).toBe('not_measured');
  });

  it('explains each level in plain language (title)', () => {
    expect(render('not_measured').el.getAttribute('title')).toBe('COMPLIANCE.STATUS_HINT.NOT_MEASURED');
  });
});
