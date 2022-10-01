import { strict as assert } from 'node:assert';
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

  describe('validator.from()', () => {
    it('converts a string to a validator', () => {
      const v = validator.from('string');
      expect(v.matches('xyz')).toBe(true);
      expect(v.matches(2)).toBe(false);
    });

    it('returns validator instances as-is', () => {
      const v1 = validator`string`;
      const v2 = validator.from(v1);
      expect(v1).toBe(v2);
    });
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
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
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
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
    });
  });

  describe('validator.createValidatable()', () => {
    test('accepts a value that conforms to the custom validatable function', () => {
      const v = validator`${validator.createValidatable(x => typeof x === 'number' && x >= 0)}`;
      v.assertMatches(2);
    });

    test('rejects a value that does not conform to the custom validatable function', () => {
      const v = validator`${validator.createValidatable(x => typeof x === 'number' && x >= 0)}`;
      const act = (): any => v.assertMatches(-2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which is -2, to match [object CustomValidatable] ' +
          '(via its validatable protocol).'
        ),
      });
    });

    test('Grabbing the `validatable` property and sticking it on another class to give it a name works', () => {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class MyValidatable {
        static [validator.validatable] = validator.createValidatable(x => typeof x === 'string').validatable;
      }

      const v = validator`${MyValidatable}`;
      v.assertMatches('xyz');
      const act = (): any => v.assertMatches(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which is 2, to match `MyValidatable` ' +
          '(via its validatable protocol).'
        ),
      });
    });
  });
});
