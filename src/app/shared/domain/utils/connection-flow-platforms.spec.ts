import { CONNECTION_FLOW_PLATFORMS, hasConnectionFlow } from './connection-flow-platforms';

describe('hasConnectionFlow', () => {
  it('knows the platforms with a wizard flow', () => {
    for (const code of CONNECTION_FLOW_PLATFORMS) expect(hasConnectionFlow(code)).toBeTrue();
    expect(hasConnectionFlow('linux')).toBeTrue();
  });

  it('does not take other names, or inherited object keys, for a platform with a flow', () => {
    expect(hasConnectionFlow('aix')).toBeFalse();
    expect(hasConnectionFlow('constructor')).toBeFalse();
    expect(hasConnectionFlow('')).toBeFalse();
  });
});
