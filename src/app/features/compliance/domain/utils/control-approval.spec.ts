import { approvalErrorKey, can, isStaleConflict, managementTone, personLabel, requestTone } from './control-approval';

describe('managementTone', () => {
  it('colours each state and falls back to neutral', () => {
    expect(managementTone('approved')).toBe('ok');
    expect(managementTone('owner_approved')).toBe('info');
    expect(managementTone('pending_approval')).toBe('info');
    expect(managementTone('in_progress')).toBe('neutral');
    expect(managementTone('returned')).toBe('warn');
    expect(managementTone('non_compliant')).toBe('bad');
    expect(managementTone('new_one')).toBe('neutral');
  });
});

describe('requestTone', () => {
  it('marks a pending request as attention, an approved one ok and a rejected one bad', () => {
    expect(requestTone('pending')).toBe('warn');
    expect(requestTone('approved')).toBe('ok');
    expect(requestTone('rejected')).toBe('bad');
    expect(requestTone('other')).toBe('neutral');
  });
});

describe('can', () => {
  it('is true only when the server allowed the action', () => {
    expect(can(['approve', 'return'], 'approve')).toBeTrue();
    expect(can(['approve'], 'decide_level')).toBeFalse();
    expect(can([], 'approve')).toBeFalse();
    expect(can(null, 'approve')).toBeFalse();
  });
});

describe('personLabel', () => {
  it('joins name and last name, with a dash when there is none', () => {
    expect(personLabel({ name: 'Ana', last_name: 'Pérez' })).toBe('Ana Pérez');
    expect(personLabel({ name: null, last_name: null })).toBe('—');
    expect(personLabel(null)).toBe('—');
  });
});

describe('conflict texts', () => {
  it('has a text for the codes of this flow and none for the rest', () => {
    expect(approvalErrorKey('LEVEL_OVERRIDE_PENDING')).toBe('COMPLIANCE.APPROVAL.ERR.LEVEL_OVERRIDE_PENDING');
    expect(approvalErrorKey('LAST_APPLICABLE_REQUIREMENT')).toBe('COMPLIANCE.APPROVAL.ERR.LAST_APPLICABLE_REQUIREMENT');
    expect(approvalErrorKey('ALREADY_DECIDED')).toBe('COMPLIANCE.APPROVAL.ERR.ALREADY_DECIDED');
    expect(approvalErrorKey('REQUEST_NO_LONGER_VALID')).toBe('COMPLIANCE.APPROVAL.ERR.REQUEST_NO_LONGER_VALID');
    expect(approvalErrorKey('SOMETHING_ELSE')).toBeNull();
    expect(approvalErrorKey(null)).toBeNull();
  });

  it('asks for a refresh when the control already changed', () => {
    expect(isStaleConflict('ALREADY_DECIDED')).toBeTrue();
    expect(isStaleConflict('LEVEL_OVERRIDE_PENDING')).toBeTrue();
    expect(isStaleConflict('TEST_NOT_MANUAL')).toBeFalse();
  });
});
