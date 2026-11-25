import { DashboardFramework } from '../models/dashboard.models';
import { serviceReadiness } from './service-status';

const fw = (readiness: string, verdict: string | null = null): DashboardFramework => ({ code: 'x', name: 'X', readiness, verdict, progress: { done: 1, total: 2 }, coverage: { measured: 1, applicable: 2 }, periodDefined: true });

describe('serviceReadiness', () => {
  it('takes the worst framework', () => {
    expect(serviceReadiness([fw('ready'), fw('needs_work')])).toBe('needs_work');
    expect(serviceReadiness([fw('ready'), fw('almost_ready')])).toBe('almost_ready');
    expect(serviceReadiness([fw('ready'), fw('ready')])).toBe('ready');
  });
  it('treats a measured framework the engine calls non-compliant as needing work', () => {
    expect(serviceReadiness([fw('almost_ready', 'non_compliant')])).toBe('needs_work');
    expect(serviceReadiness([fw('not_measured', 'non_compliant')])).toBe('not_measured');
  });
  it('never says ready while something is pending', () => {
    expect(serviceReadiness([fw('ready'), fw('not_measured')])).toBe('not_measured');
    expect(serviceReadiness([])).toBe('not_measured');
  });
});
