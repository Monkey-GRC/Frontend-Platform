import { remediationBlocks } from './remediation-text';

describe('remediationBlocks', () => {
  it('removes the formatting marks and keeps the words', () => {
    expect(remediationBlocks('Enable **IAM Access Analyzer** (*or organization-wide*) and `Active` findings.')).toEqual([
      { kind: 'p', text: 'Enable IAM Access Analyzer (or organization-wide) and Active findings.' },
    ]);
  });

  it('turns the dash lines into bullets and the others into paragraphs', () => {
    expect(remediationBlocks('Adopt:\n- **Primary** contacts\n- Shared aliases\n\nDone.')).toEqual([
      { kind: 'p', text: 'Adopt:' },
      { kind: 'li', text: 'Primary contacts' },
      { kind: 'li', text: 'Shared aliases' },
      { kind: 'p', text: 'Done.' },
    ]);
  });

  it('keeps HTML as plain text: the template prints it escaped', () => {
    expect(remediationBlocks('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'p', text: '<img src=x onerror=alert(1)>' }]);
  });

  it('returns nothing for an empty text', () => {
    expect(remediationBlocks('  \n ')).toEqual([]);
  });
});