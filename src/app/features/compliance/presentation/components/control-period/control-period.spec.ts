import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ControlPeriod } from '@features/compliance/domain/models/control.models';
import { ControlPeriodView } from './control-period';

const PERIOD: ControlPeriod = { level: 'weak', complies: false, windows: { total: 4, with_evidence: 3 }, missing: [{ requirement_code: 'IAC-12-L2', window_start: '2026-07-01', window_end: '2026-09-30' }] };

describe('ControlPeriodView', () => {
  let fixture: ComponentFixture<ControlPeriodView>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(period: ControlPeriod): void {
    TestBed.configureTestingModule({ imports: [ControlPeriodView], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(ControlPeriodView);
    fixture.componentRef.setInput('period', period);
    fixture.detectChanges();
  }

  it('muestra el nivel del período, las ventanas con evidencia y cada ventana cerrada sin evidencia con su requisito', () => {
    render(PERIOD);
    expect(el().querySelector('[data-period-level][data-tone="warn"]')).not.toBeNull();
    expect(el().textContent).toContain('COMPLIANCE.REQS.PERIOD_WINDOWS_VALUE');
    expect(el().querySelector('app-data-table')?.textContent).toContain('IAC-12-L2');
    expect(el().querySelector('[data-period-complete]')).toBeNull();
  });

  it('dice que no falta nada cuando todas las ventanas cerradas tienen evidencia', () => {
    render({ ...PERIOD, level: 'solid', complies: true, windows: { total: 4, with_evidence: 4 }, missing: [] });
    expect(el().querySelector('app-data-table')).toBeNull();
    expect(el().querySelector('[data-period-complete]')).not.toBeNull();
    expect(el().querySelector('[data-period-level][data-tone="ok"]')).not.toBeNull();
  });
});
