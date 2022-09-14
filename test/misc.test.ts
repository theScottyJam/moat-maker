import { validator, ValidatorAssertionError } from '../src';

describe('validator behavior', () => {
  test('returns a frozen object', () => {
    const v = validator`string`;
    expect(Object.isFrozen(v)).toBe(true);
  });

  test('matches() returns true if the provided value is valid', () => {
    const v = validator`string`;
    expect(v.matches('xyz')).toBe(true);
  });

  test('matches() returns false if the provided value is invalid', () => {
    const v = validator`string`;
    expect(v.matches(2)).toBe(false);
  });

  test('assertMatches() returns the argument', () => {
    const v = validator`string`;
    expect(v.assertMatches('xyz')).toBe('xyz');
  });

  // A small handful of random tests to make sure this function works.
  describe('validator.fromRules()', () => {
    test('allows string inputs when given a simple string rule', () => {
      const v = validator.fromRule({
        category: 'simple',
        type: 'string',
      });
      v.assertMatches('xyz');
    });

    test('forbids string inputs when given a simple number rule', () => {
      const v = validator.fromRule({
        category: 'simple',
        type: 'number',
      });
      const act = (): any => v.assertMatches('xyz');
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "number" but got type "string".');
    });

    test('validator behavior does not change, even if input rule is mutated', () => {
      const rule = {
        category: 'simple',
        type: 'number',
      } as const;

      const v = validator.fromRule(rule);
      (rule as any).type = 'string';

      // Just making sure it actually mutates, and that fromRule didn't freeze the input object.
      expect(rule.type).toBe('string');

      const act = (): any => v.assertMatches('xyz');
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "number" but got type "string".');
    });
  });
});
