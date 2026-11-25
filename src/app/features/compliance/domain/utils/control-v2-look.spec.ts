import { CheckLink, ControlRequirement } from '../models/control.models';
import { groupByRole, levelTone, statusTone, summarizeRequirements } from './control-v2-look';

const link = (role: CheckLink['role']): CheckLink => ({ role, kind: 'check', check: { id: role, title: role }, module: null, failing_assets: null, owner: null });
const req = (status: ControlRequirement['status']): ControlRequirement => ({ id: status, code: 'IAC-12-L2', text: '', type: 'operational', periodicity: 'quarterly', status, tests: [] });

describe('control-v2-look', () => {
  it('agrupa los vínculos Directo, Complementario, Dependencia y omite los roles vacíos', () => {
    const groups = groupByRole([link('dependency'), link('direct'), link('direct')]);
    expect(groups.map((g) => g.role)).toEqual(['direct', 'dependency']);
    expect(groups[0].links.length).toBe(2);
  });

  it('solo Adecuado y Sólido tienen tono de cumplimiento', () => {
    expect(levelTone('adequate')).toBe('ok');
    expect(levelTone('solid')).toBe('ok');
    expect(levelTone('partial')).toBe('warn');
    expect(levelTone('weak')).toBe('bad');
    expect(levelTone('otro')).toBe('neutral');
  });

  it('da tono a los estados de requisito y de prueba', () => {
    expect(statusTone('compliant')).toBe('ok');
    expect(statusTone('exception')).toBe('bad');
    expect(statusTone('observation')).toBe('warn');
    expect(statusTone('not_applicable')).toBe('neutral');
  });

  it('resume los requisitos sin contar los No aplica', () => {
    expect(summarizeRequirements([req('compliant'), req('non_compliant'), req('pending'), req('not_applicable')])).toEqual({ applicable: 3, compliant: 1, missing: 2 });
  });
});
