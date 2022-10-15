import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('validator behavior', () => {
  test('a validator instance is a frozen object', () => {
    const v = validator`string`;
    expect(Object.isFrozen(v)).toBe(true);
  });

  describe('validator.assertMatches()', () => {
    test('returns the argument', () => {
      const v = validator`string`;
      expect(v.assertMatches('xyz')).toBe('xyz');
    });

    test('throws on bad input', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
    });
  });

  describe('validator.getAsserted()', () => {
    test('returns the argument', () => {
      const v = validator`string`;
      expect(v.getAsserted('xyz')).toBe('xyz');
    });

    test('throws on bad input', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
    });
  });

  describe('validator.matches()', () => {
    test('returns true if the provided value is valid', () => {
      const v = validator`string`;
      expect(v.matches('xyz')).toBe(true);
    });

    test('returns false if the provided value is invalid', () => {
      const v = validator`string`;
      expect(v.matches(2)).toBe(false);
    });
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

  describe('validator.fromRule()', () => {
    test('allows string inputs when given a simple string rule', () => {
      const v = validator.fromRule({
        category: 'simple',
        type: 'string',
      });
      v.getAsserted('xyz');
    });

    test('forbids string inputs when given a simple number rule', () => {
      const v = validator.fromRule({
        category: 'simple',
        type: 'number',
      });
      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
    });

    test('allow providing interpolated values', () => {
      const v = validator.fromRule({
        category: 'interpolation',
        interpolationIndex: 0,
      }, [2]);
      expect(v.matches(2)).toBe(true);
      expect(v.matches(3)).toBe(false);
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

      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
    });
  });

  describe('validator.createRef()', () => {
    test('enables self-referencing patterns', () => {
      const consRef = validator.createRef();
      const v = validator`{ value: unknown, next: ${consRef} } | null`;
      consRef.set(v);

      expect(v.matches(null)).toBe(true);
      expect(v.matches({ value: 1, next: null })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: null } })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: { value: 3, next: null } } })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: { value: 3, next: 'xyz' } } })).toBe(false);
    });

    test('can not use a pattern with a ref until the ref has been set', () => {
      const consRef = validator.createRef();
      const v = validator`{ value: unknown, next: ${consRef} } | null`;

      // Note that this doesn't trigger the error since it matches without the ref pattern needing to be checked
      v.matches(null);

      const act = (): any => v.matches({ value: 2, next: null });
      assert.throws(act, (err: Error) => err.constructor === Error);
      assert.throws(act, { message: 'Can not use a pattern with a ref until ref.set(...) has been called.' });
    });

    // This behavior is more of a side-effect of how the validator works.
    // It certainly shouldn't be considered a stable behavior for people to rely on, as what
    // gets short-circuited can change at any point in time.
    // The test is mostly here to document that this is a thing, and to inform us if this behavior changes drastically.
    test('able to use a pattern with an unset ref if the ref gets short-circuited during validation', () => {
      const consRef = validator.createRef();
      const v = validator`{ next: ${consRef} }`;
      // The consRef's validatable protocol never executes because this fails the is-this-an-object test first.
      v.matches(null);
    });

    test('can not call ref.set() multiple times', () => {
      const consRef = validator.createRef();
      const v = validator`{ value: unknown, next: ${consRef} } | null`;
      consRef.set(v);
      const act = (): any => consRef.set(v);

      assert.throws(act, (err: Error) => err.constructor === Error);
      assert.throws(act, { message: 'Can not call ref.set(...) multiple times.' });
    });

    test('can not call ref.set() with a non-validator instance', () => {
      const consRef = validator.createRef();
      const act = (): any => consRef.set({} as any);
      assert.throws(act, (err: Error) => err.constructor === Error);
      assert.throws(act, { message: 'Must call ref.set(...) with a validator instance. Received the non-validator [object Object].' });
    });
  });

  describe('validator.createValidatable()', () => {
    test('accepts a value that conforms to the custom validatable function', () => {
      const v = validator`${validator.createValidatable(x => typeof x === 'number' && x >= 0)}`;
      v.getAsserted(2);
    });

    test('rejects a value that does not conform to the custom validatable function', () => {
      const v = validator`${validator.createValidatable(x => typeof x === 'number' && x >= 0)}`;
      const act = (): any => v.getAsserted(-2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which is -2, to match a custom validatable.'
        ),
      });
    });

    test('you can give your validatable object a custom description for error messages to use', () => {
      const v = validator`${validator.createValidatable(x => typeof x === 'number' && x >= 0, { to: 'be positive' })}`;
      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>, which is "xyz", to be positive' });
    });

    test('you can move the custom validatable protocol to your own class', () => {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class MyValidatable {
        static [validator.validatable] = validator.createValidatable(x => typeof x === 'string').protocolFn;
      }

      const v = validator`${MyValidatable}`;
      v.getAsserted('xyz');
      const act = (): any => v.getAsserted(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>, which is 2, to match a custom validatable.' });
    });
  });

  test('forbids outside users from instantiating ValidatorSyntaxError', () => {
    const act = (): any => new (ValidatorSyntaxError as any)('Whoops!');
    assert.throws(act, (err: Error) => err.constructor === Error);
    assert.throws(act, { message: 'The ValidatorSyntaxError constructor is private.' });
  });

  test('ValidatorAssertionError.isAssertionError() does an instanceof check', () => {
    class MyValidatorAssertionError extends ValidatorAssertionError {}
    expect(ValidatorAssertionError.isAssertionError(new ValidatorAssertionError('my message'))).toBe(true);
    expect(ValidatorAssertionError.isAssertionError(new MyValidatorAssertionError('my message'))).toBe(true);
    expect(ValidatorAssertionError.isAssertionError(new Error('my message'))).toBe(false);
  });
});
