import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { RiskReadinessService } from '@features/compliance/domain/services/risk-readiness.service';
import { RiskProgress } from '@features/compliance/domain/utils/risk-progress';
import { risksEvaluatedGuard } from './risks-evaluated.guard';

describe('risksEvaluatedGuard (D89)', () => {
  const progress = (pending: number): RiskProgress => ({ total: 10, evaluated: 10 - pending, pending, ready: pending === 0 });

  async function run(result: Observable<RiskProgress>, id: string | null = 'svc-1'): Promise<boolean | string> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RiskReadinessService, useValue: { progress: () => result } }] });
    const route = { paramMap: convertToParamMap(id ? { id } : {}) } as ActivatedRouteSnapshot;
    const res = TestBed.runInInjectionContext(() => risksEvaluatedGuard(route, {} as never)) as boolean | UrlTree | Observable<boolean | UrlTree>;
    const out = isObservable(res) ? await firstValueFrom(res) : res;
    return out instanceof UrlTree ? TestBed.inject(Router).serializeUrl(out) : out;
  }

  it('lets the person declare assets once every risk of the service is evaluated', async () => {
    expect(await run(of(progress(0)))).toBeTrue();
  });

  it('sends them to the service, which opens the risk assistant, while any risk of THAT service is missing', async () => {
    expect(await run(of(progress(3)))).toBe('/services/svc-1?evaluar=riesgos');
  });

  it('does not block when it cannot tell (the page itself will show the error)', async () => {
    expect(await run(throwError(() => new Error('down')))).toBeTrue();
  });

  it('does nothing without a service in the route', async () => {
    expect(await run(of(progress(3)), null)).toBeTrue();
  });
});
