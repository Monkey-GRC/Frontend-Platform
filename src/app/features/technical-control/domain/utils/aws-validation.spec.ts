import { cleanAwsAccountId, isAwsAccountId } from './aws-validation';

describe('aws-validation', () => {
  it('accepts exactly 12 digits', () => {
    expect(isAwsAccountId('123456789012')).toBeTrue();
    expect(isAwsAccountId('12345678901')).toBeFalse();
    expect(isAwsAccountId('1234567890123')).toBeFalse();
    expect(isAwsAccountId('12345678901a')).toBeFalse();
  });

  it('keeps only the digits, up to 12', () => {
    expect(cleanAwsAccountId('1234-5678 9012 99')).toBe('123456789012');
  });
});
