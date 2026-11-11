import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ComplianceBanner } from './compliance-banner';

describe('ComplianceBanner', () => {
  let fixture: ComponentFixture<ComplianceBanner>;
  const root = () => fixture.nativeElement as HTMLElement;

  function setup(inputs: Record<string, unknown> = {}): void {
    TestBed.configureTestingModule({ imports: [ComplianceBanner], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ComplianceBanner);
    fixture.componentRef.setInput('eyebrow', 'Cumplimiento');
    fixture.componentRef.setInput('title', 'Riesgos');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('shows the eyebrow, the section and the service, with the framework as plain text and no icon or link', () => {
    setup({ service: 'Servicio de IA', frameworks: [{ code: 'soc2', label: 'SOC 2' }] });
    expect(root().querySelector('[data-banner-eyebrow]')!.textContent).toBe('Cumplimiento');
    expect(root().querySelector('h1')!.textContent).toBe('Riesgos');
    expect(root().querySelector('[data-banner-service]')!.textContent).toBe('Servicio de IA');
    expect(root().querySelector('[data-banner-framework]')!.textContent).toBe('SOC 2');
    expect(root().querySelector('a')).toBeNull();
    expect(root().querySelector('.material-symbols-rounded, .material-symbols-outlined, svg, img')).toBeNull();
  });

  it('shows no context line, period or action when it is given none', () => {
    setup();
    expect(root().querySelector('[data-banner-insight]')).toBeNull();
    expect(root().querySelector('[data-banner-period]')).toBeNull();
    expect(root().querySelector('[data-edit-period]')).toBeNull();
  });

  it('turns the frameworks into buttons when they can be chosen, and tells which one', () => {
    setup({ frameworks: [{ code: 'soc2', label: 'SOC 2' }, { code: 'iso', label: 'ISO' }], selectable: true, selected: 'iso' });
    const picks = Array.from(root().querySelectorAll<HTMLButtonElement>('[data-framework-pick]'));
    expect(picks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    let picked = '';
    fixture.componentInstance.frameworkPick.subscribe((c) => (picked = c));
    picks[0].click();
    expect(picked).toBe('soc2');
  });

  it('emits «change period» only when it can be edited', () => {
    setup({ period: 'Período 1 ene 2026 – 31 dic 2026', canEditPeriod: false });
    expect(root().querySelector('[data-edit-period]')).toBeNull();
    fixture.componentRef.setInput('canEditPeriod', true);
    fixture.detectChanges();
    let emitted = 0;
    fixture.componentInstance.periodEdit.subscribe(() => emitted++);
    (root().querySelector('[data-edit-period]') as HTMLButtonElement).click();
    expect(emitted).toBe(1);
  });

  it('uses the brand gradient from the tokens, with white text', () => {
    setup();
    const style = getComputedStyle(root().querySelector('header')!);
    expect(style.color).toBe('rgb(255, 255, 255)');
    expect(style.backgroundImage).toContain('linear-gradient');
  });
});
