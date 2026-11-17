import { isUuid } from './uuid';

describe('isUuid', () => {
  it('only accepts a uuid', () => {
    expect(isUuid('7e5b2c90-3a14-4f8d-b062-1c9e7a3f5d28')).toBeTrue();
    for (const bad of ['', null, undefined, '../x', '7e5b2c90', '7e5b2c90-3a14-4f8d-b062-1c9e7a3f5d28/x', '7e5b2c90-3a14-4f8d-b062-1c9e7a3f5d28?x=1']) expect(isUuid(bad)).toBeFalse();
  });
});
