import { validator } from '../src/index.js';

describe('noop rules', () => {
  describe('unknown', () => {
    test('accepts string inputs', () => {
      const v = validator`unknown`;
      v.assertMatches('xyz');
    });

    test('XXX', () => {
      const v = validator`unknown`;
      v.assertMatches('xyz');
    });

    test('accepts object inputs', () => {
      const v = validator`unknown`;
      v.assertMatches({ x: 2 });
    });

    test('produces the correct rule', () => {
      const v = validator`unknown`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'noop',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('any', () => {
    test('produces the same rule structure as "unknown"', () => {
      expect(validator`any`.ruleset.rootRule).toMatchObject({ category: 'noop' });
      expect(validator`unknown`.ruleset.rootRule).toMatchObject({ category: 'noop' });
    });
  });
});
