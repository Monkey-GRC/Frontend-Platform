import { makeNotification } from '@features/notifications/testing/notification-fixtures';
import { MAX_CARD_CODES, cardCodes, noticeAppearance } from './notification-appearance';

describe('noticeAppearance', () => {
  it('alerts for windows and failures, information for assignments', () => {
    expect(noticeAppearance('window_due_soon').tone).toBe('warn');
    expect(noticeAppearance('direct_check_failed').tone).toBe('bad');
    expect(noticeAppearance('control_assigned')).toEqual({ icon: 'assignment_ind', tone: 'info' });
  });

  it('falls back to information for a type it does not know', () => {
    expect(noticeAppearance('something_new')).toEqual({ icon: 'info', tone: 'info' });
  });
});

describe('cardCodes', () => {
  it('lists the control code first and then its requirements', () => {
    expect(cardCodes(makeNotification()).codes).toEqual(['IAC-12', 'CC6.1', 'CC6.2']);
  });

  it('lists the grouped controls of an unassigned notice', () => {
    const grouped = makeNotification({ control: null, controls: [{ id: 'a', code: 'IAC-01' }, { id: 'b', code: 'IAC-02' }] });
    expect(cardCodes(grouped).codes).toEqual(['IAC-01', 'IAC-02']);
  });

  it('has no codes for a company notice without a control', () => {
    expect(cardCodes(makeNotification({ control: null, controls: [] }))).toEqual({ codes: [], more: 0, hidden: [] });
  });

  it('keeps a card with many codes in order: shows the first and counts the rest', () => {
    const many = Array.from({ length: 12 }, (_, i) => `CC${i + 1}.1`);
    const result = cardCodes(makeNotification({ control: { id: 'c', code: 'IAC-12', name: 'x', requirement_codes: many } }));
    expect(result.codes.length).toBe(MAX_CARD_CODES);
    expect(result.more).toBe(13 - MAX_CARD_CODES);
    expect(result.hidden.length).toBe(result.more);
  });
});
