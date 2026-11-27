import { ControlDetail } from '../models/control.models';
import { onDemandRequirementsByTest } from './control-occurrence';

const detail = (over: Record<string, unknown> = {}): ControlDetail =>
  ({
    management: {
      requirements: [{ id: 'r1', on_demand: { window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 2, occurrences_without_evidence: 1, has_declaration: false } }, { id: 'r2', on_demand: null }],
      manual_tests: [],
    },
    ...over,
  }) as unknown as ControlDetail;

describe('onDemandRequirementsByTest', () => {
  it('maps the manual non-documentary test to its on-demand requirement', () => {
    const d = detail();
    (d.management.manual_tests as unknown[]).push({ test: { id: 't1' }, requirement_id: 'r1' });
    expect(onDemandRequirementsByTest(d).get('t1')).toBe('r1');
  });

  it('ignores documentary tests (only in evidence_tests, never in manual_tests)', () => {
    const d = detail({ evidence_tests: [{ test_id: 't1', requirement_id: null, control_requirement_id: 'r1' }] });
    expect(onDemandRequirementsByTest(d).size).toBe(0);
  });

  it('skips tests of a requirement that is not on demand or has no requirement', () => {
    const d = detail();
    (d.management.manual_tests as unknown[]).push({ test: { id: 't2' }, requirement_id: 'r2' }, { test: { id: 't3' }, requirement_id: null });
    expect(onDemandRequirementsByTest(d).size).toBe(0);
  });
});
