import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { wizardLeaveGuard } from './wizard-leave.guard';
import { WizardLeaveService } from '../services/wizard-leave.service';

describe('wizardLeaveGuard', () => {
  const run = () => TestBed.runInInjectionContext(() => wizardLeaveGuard(null, {} as never, {} as never, {} as never)) as Promise<boolean>;

  it('lets leave at once when there is nothing to lose', async () => {
    const svc = TestBed.inject(WizardLeaveService);
    expect(await run()).toBeTrue();
    expect(svc.asking()).toBeFalse();
  });

  for (const mode of ['discard', 'saved'] as const) {
    it(`asks before leaving when the mode is ${mode}, and follows the answer`, async () => {
      const svc = TestBed.inject(WizardLeaveService);
      svc.mode.set(mode);
      const stay = run();
      expect(svc.asking()).toBeTrue();
      svc.answer(false);
      expect(await stay).toBeFalse();
      expect(svc.asking()).toBeFalse();
      const leave = run();
      svc.answer(true);
      expect(await leave).toBeTrue();
    });
  }

  it('is a canDeactivate guard usable on a route', () => {
    const route: Route = { path: 'x', canDeactivate: [wizardLeaveGuard] };
    expect(route.canDeactivate?.length).toBe(1);
  });
});
