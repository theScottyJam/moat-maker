import { validator } from '../src';

describe('noop rules', () => {
  describe('unknown', () => {
    test('accepts string inputs', () => {
      const v = validator`unknown`;
      v.getAsserted('xyz');
    });

    test('accepts object inputs', () => {
      const v = validator`unknown`;
      v.getAsserted({ x: 2 });
    });

    test('produces the correct rule', () => {
      const v = validator`unknown`;
      expect(v.rule).toMatchObject({ category: 'noop' });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('any', () => {
    test('produces the same rule structure as "unknown"', () => {
      expect(validator`any`.rule).toMatchObject({ category: 'noop' });
      expect(validator`unknown`.rule).toMatchObject({ category: 'noop' });
    });
  });
});
