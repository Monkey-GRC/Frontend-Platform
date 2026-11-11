import { HomeTeamMember } from '../models/team.models';
import { STALE_LOGIN_DAYS, summarizeTeam } from './team-summary';

const member = (patch: Partial<HomeTeamMember>): HomeTeamMember => ({ role: 'delegado', status: 'active', mfaEnabled: true, lastLoginAt: null, ...patch });

describe('summarizeTeam', () => {
  it('counts people by role and by status, leaving out deactivated and suspended accounts', () => {
    const s = summarizeTeam([
      member({ role: 'admin_empresa' }),
      member({ role: 'responsable' }),
      member({ role: 'delegado' }),
      member({ role: 'delegado', status: 'pending', mfaEnabled: false }),
      member({ role: 'auditor', status: 'inactive' }),
      member({ role: 'auditor', status: 'suspended' }),
    ]);
    expect(s.total).toBe(4);
    expect(s.active).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.byRole).toEqual({ admin_empresa: 1, responsable: 1, delegado: 2, auditor: 0 });
  });

  it('counts only active accounts without a second factor (a pending invitation cannot have one yet)', () => {
    const s = summarizeTeam([member({ mfaEnabled: false }), member({}), member({ status: 'pending', mfaEnabled: false }), member({ status: 'inactive', mfaEnabled: false })]);
    expect(s.withoutSecondFactor).toBe(1);
  });

  describe('access rows', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

    it('counts active accounts that never logged in or whose last login is older than the threshold', () => {
      const s = summarizeTeam(
        [
          member({ lastLoginAt: daysAgo(1) }),
          member({ lastLoginAt: daysAgo(STALE_LOGIN_DAYS - 1) }),
          member({ lastLoginAt: daysAgo(STALE_LOGIN_DAYS + 1) }),
          member({ lastLoginAt: null }),
          member({ status: 'pending', lastLoginAt: null }),
          member({ status: 'suspended', lastLoginAt: null }),
        ],
        now,
      );
      expect(s.withoutRecentLogin).toBe(2);
    });

    it('counts suspended and deactivated accounts apart, and only active administrators', () => {
      const s = summarizeTeam(
        [
          member({ role: 'admin_empresa' }),
          member({ role: 'admin_empresa', status: 'pending' }),
          member({ role: 'admin_empresa', status: 'suspended' }),
          member({ status: 'inactive' }),
          member({ status: 'suspended' }),
        ],
        now,
      );
      expect(s.blocked).toBe(3);
      expect(s.activeAdmins).toBe(1);
      expect(s.total).toBe(2);
    });
  });

  it('is all zeros for an empty team', () => {
    expect(summarizeTeam([]).total).toBe(0);
  });
});
