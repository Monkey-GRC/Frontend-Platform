import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { EvaluationPeriodItem } from '@features/compliance/domain/models/overview.models';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { EvaluationPeriodHistory } from './evaluation-period-history';

const period = (id: string, status: 'open' | 'closed', start: string, end: string): EvaluationPeriodItem => ({
  id,
  status,
  period_start: start,
  period_end: end,
  cutoff_date: null,
  opened_by: 'system',
  closed_at: status === 'closed' ? `${end}T10:00:00Z` : null,
});

const OPEN = period('p3', 'open', '2026-01-01', '2026-12-31');
const CLOSED = [period('p2', 'closed', '2025-01-01', '2025-12-31'), period('p1', 'closed', '2024-01-01', '2024-12-31')];

describe('EvaluationPeriodHistory', () => {
  let fixture: ComponentFixture<EvaluationPeriodHistory>;
  let api: jasmine.SpyObj<OverviewService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(answer: Observable<EvaluationPeriodItem[]>): void {
    api.listEvaluationPeriods.and.returnValue(answer);
    fixture = TestBed.createComponent(EvaluationPeriodHistory);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.componentRef.setInput('frameworkCode', 'soc2');
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<OverviewService>('OverviewService', ['listEvaluationPeriods']);
    TestBed.configureTestingModule({
      imports: [EvaluationPeriodHistory],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: OverviewService, useValue: api }],
    });
  });

  it('shows the loading skeleton until the periods arrive', () => {
    render(new Subject<EvaluationPeriodItem[]>());
    expect(el().querySelector('[data-history-loading]')).not.toBeNull();
    expect(el().querySelector('[data-history]')).toBeNull();
  });

  it('asks for the periods of the service and framework and lists only the closed ones', () => {
    render(of([OPEN, ...CLOSED]));
    expect(api.listEvaluationPeriods).toHaveBeenCalledOnceWith('s1', 'soc2');
    expect(el().querySelector('[data-history-loading]')).toBeNull();
    expect(el().querySelector('[data-history]')).not.toBeNull();
    expect(el().querySelectorAll('app-data-table tbody tr').length).toBe(2);
  });

  it('shows nothing when no period has closed yet', () => {
    render(of([OPEN]));
    expect(el().querySelector('[data-history]')).toBeNull();
    expect(el().querySelector('[data-history-error]')).toBeNull();
    expect(el().querySelector('[data-history-loading]')).toBeNull();
  });

  it('says it could not load and retries on demand', () => {
    render(throwError(() => new Error('down')));
    expect(el().querySelector('[data-history-error]')).not.toBeNull();
    expect(el().querySelector('[data-history]')).toBeNull();

    api.listEvaluationPeriods.and.returnValue(of(CLOSED));
    (el().querySelector('[data-history-error] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.listEvaluationPeriods).toHaveBeenCalledTimes(2);
    expect(el().querySelector('[data-history-error]')).toBeNull();
    expect(el().querySelector('[data-history]')).not.toBeNull();
  });

  it('asks again when the service or the framework changes and drops the answer of the previous request', () => {
    const first = new Subject<EvaluationPeriodItem[]>();
    const second = new Subject<EvaluationPeriodItem[]>();
    render(first);
    api.listEvaluationPeriods.and.returnValue(second);
    fixture.componentRef.setInput('frameworkCode', 'iso27001');
    fixture.detectChanges();
    expect(api.listEvaluationPeriods).toHaveBeenCalledTimes(2);
    expect(api.listEvaluationPeriods).toHaveBeenCalledWith('s1', 'iso27001');

    first.next(CLOSED);
    fixture.detectChanges();
    expect(el().querySelector('[data-history]')).toBeNull();
    expect(el().querySelector('[data-history-loading]')).not.toBeNull();

    second.next([period('p9', 'closed', '2023-01-01', '2023-12-31')]);
    fixture.detectChanges();
    expect(el().querySelectorAll('app-data-table tbody tr').length).toBe(1);
  });

  it('does not let the error of a previous request overwrite the answer of the current one', () => {
    const first = new Subject<EvaluationPeriodItem[]>();
    render(first);
    api.listEvaluationPeriods.and.returnValue(of(CLOSED));
    fixture.componentRef.setInput('serviceId', 's2');
    fixture.detectChanges();
    first.error(new Error('late'));
    fixture.detectChanges();
    expect(el().querySelector('[data-history-error]')).toBeNull();
    expect(el().querySelector('[data-history]')).not.toBeNull();
  });
});
