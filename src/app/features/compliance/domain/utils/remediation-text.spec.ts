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

  // D112 · Los comandos van en su propio bloque y se conservan tal cual.
  it('puts a fenced command in its own code block and keeps it exactly as written', () => {
    expect(remediationBlocks('Ejecute el comando:\n```bash\nprintf "install %s\\n" cramfs   > /etc/modprobe.d/cramfs.conf\n  modprobe -r cramfs\n```\nY reinicie.')).toEqual([
      { kind: 'p', text: 'Ejecute el comando:' },
      { kind: 'code', text: 'printf "install %s\\n" cramfs   > /etc/modprobe.d/cramfs.conf\n  modprobe -r cramfs' },
      { kind: 'p', text: 'Y reinicie.' },
    ]);
  });

  it('does not strip formatting marks inside a code block (a command may contain * or backticks-like text)', () => {
    expect(remediationBlocks('```\nfind / -name *.conf -perm **\n```')).toEqual([{ kind: 'code', text: 'find / -name *.conf -perm **' }]);
  });

  it('does not lose text when a block is not closed: it shows as plain text', () => {
    const out = remediationBlocks('Pasos:\n```\nsin cerrar');
    expect(out.some((b) => b.kind === 'code')).toBe(false);
    expect(out.map((b) => b.text).join(' ')).toContain('sin cerrar');
  });

  it('keeps HTML inside a code block as text too', () => {
    expect(remediationBlocks('```\n<img src=x onerror=alert(1)>\n```')).toEqual([{ kind: 'code', text: '<img src=x onerror=alert(1)>' }]);
  });

  it('returns nothing for an empty text', () => {
    expect(remediationBlocks('  \n ')).toEqual([]);
  });
});