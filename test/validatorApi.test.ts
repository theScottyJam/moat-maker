import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

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
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('able to control the start lookupPath with the "at" parameter', () => {
      const v = validator`{ y: string }`;
      const act = (): any => v.assertMatches({ y: 2 }, { at: '<someValue>.x' });
      assert.throws(act, { message: 'Expected <someValue>.x.y to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('able to control the error message prefix', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, { errorPrefix: 'Error in some place:' });
      assert.throws(act, { message: 'Error in some place: Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('the error prefix must end with ":"', () => {
      const v = validator`any`;
      const act = (): any => v.assertMatches('xyz', { errorPrefix: 'Error in some place.' });
      assert.throws(act, { message: 'The assertMatches() errorPrefix string must end with a colon.' });
      assert.throws(act, TypeError);
    });

    test('able to control the error type used with the errorFactory parameter', () => {
      class MyError extends Error {}
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, { errorFactory: (...args: any) => new MyError(...args) });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, MyError);
    });

    test('able to explicitly supply undefined to "at" and "errorFactory" parameters', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, { at: undefined, errorPrefix: undefined, errorFactory: undefined });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, Error);
    });

    test('The thrown error does not have too many unnecessary stack frames in the call stack', () => {
      // Using a nested tuple to force the error to be thrown from deeper, recursive logic.
      const v = validator`[[[[string]]]]`;
      const myUniquelyNamedFn = (): any => v.assertMatches([[[[2]]]]);
      assert.throws(myUniquelyNamedFn, (error: Error) => {
        assert(error.stack !== undefined);
        return error.stack.split('\n').slice(0, 6).join('\n').includes('myUniquelyNamedFn');
      });
    });

    test('The thrown error does not have too many unnecessary stack frames in the call stack - with custom error', () => {
      class MyError extends Error {}
      const errorFactory = (...args: any): any => new MyError(...args);

      // Using a nested tuple to force the error to be thrown from deeper, recursive logic.
      const v = validator`[[[[string]]]]`;
      const myUniquelyNamedFn = (): any => v.assertMatches([[[[2]]]], { errorFactory });
      assert.throws(myUniquelyNamedFn, (error: Error) => {
        assert(error.stack !== undefined);
        return error.stack.split('\n').slice(0, 6).join('\n').includes('myUniquelyNamedFn');
      });
    });
  });

  describe('validator.assertionTypeGuard()', () => {
    test('returns undefined', () => {
      const v = validator`string`;
      expect(v.assertionTypeGuard('xyz')).toBe(undefined);
    });

    test('throws on bad input', () => {
      const v = validator`string`;
      const act = (): any => v.assertionTypeGuard(2);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('able to control the start lookupPath with the "at" parameter', () => {
      const v = validator`{ y: string }`;
      const act = (): any => v.assertionTypeGuard({ y: 2 }, { at: '<someValue>.x' });
      assert.throws(act, { message: 'Expected <someValue>.x.y to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('able to control the error message prefix', () => {
      const v = validator`string`;
      const act = (): any => v.assertionTypeGuard(2, { errorPrefix: 'Error in some place:' });
      assert.throws(act, { message: 'Error in some place: Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('the error prefix must end with ":"', () => {
      const v = validator`any`;
      const act = (): any => v.assertionTypeGuard('xyz', { errorPrefix: 'Error in some place.' });
      assert.throws(act, { message: 'The assertionTypeGuard() errorPrefix string must end with a colon.' });
      assert.throws(act, TypeError);
    });

    test('able to control the error type used with the errorFactory parameter', () => {
      class MyError extends Error {}
      const v = validator`string`;
      const act = (): any => v.assertionTypeGuard(2, { errorFactory: (...args: any) => new MyError(...args) });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, MyError);
    });

    test('able to explicitly supply undefined to "at" and "errorFactory" parameters', () => {
      const v = validator`string`;
      const act = (): any => v.assertionTypeGuard(2, { at: undefined, errorPrefix: undefined, errorFactory: undefined });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, Error);
    });

    test('The thrown error does not have too many unnecessary stack frames in the call stack', () => {
      // Using a nested tuple to force the error to be thrown from deeper, recursive logic.
      const v = validator`[[[[string]]]]`;
      const myUniquelyNamedFn = (): any => v.assertionTypeGuard([[[[2]]]]);
      assert.throws(myUniquelyNamedFn, (error: Error) => {
        assert(error.stack !== undefined);
        return error.stack.split('\n').slice(0, 6).join('\n').includes('myUniquelyNamedFn');
      });
    });

    test('The thrown error does not have too many unnecessary stack frames in the call stack - with custom error', () => {
      class MyError extends Error {}
      const errorFactory = (...args: any): any => new MyError(...args);

      // Using a nested tuple to force the error to be thrown from deeper, recursive logic.
      const v = validator`[[[[string]]]]`;
      const myUniquelyNamedFn = (): any => v.assertionTypeGuard([[[[2]]]], { errorFactory });
      assert.throws(myUniquelyNamedFn, (error: Error) => {
        assert(error.stack !== undefined);
        return error.stack.split('\n').slice(0, 6).join('\n').includes('myUniquelyNamedFn');
      });
    });
  });

  describe('validator.assertArgs()', () => {
    test('gives the right error when failing to match against a tuple with named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb: number]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for fnWithValidation(): ' +
        'Expected <argumentList>[1] to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against a tuple without named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[string, number]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected <argumentList>[1] to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against an optional entry of a tuple with named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb?: number]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for fnWithValidation(): ' +
        'Expected <argumentList>[1] to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against the "rest" entries of a tuple with named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, ...myNumbs: number[]]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumbs" arguments for fnWithValidation(): ' +
        'Expected <argumentList>.slice(1)[0] to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('error formatting does not trip up if special strings are found in odd places in error string', () => {
      // The message-updating algorithm does a find-and-replace algorithm. We want to make sure it
      // won't get tripped up and finding the wrong thing.
      function fnWithValidation(x: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: "xyz"]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('<argumentList>[2] -- Received invalid arguments for ');
      assert.throws(act, {
        message: 'Received invalid "myStr" argument for fnWithValidation(): ' +
        'Expected <argumentList>[0] to be "xyz" but got "<argumentList>[2] -- Received invalid arguments for ".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when matching against a non-tuple', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`string[]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 2);
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected <argumentList>[1] to be of type "string" but got type "number".',
      });
      assert.throws(act, TypeError);
    });

    test('accepts any array-like object', () => {
      const v = validator`[myStr: string, myNumb: number]`;
      const act = (): any => v.assertArgs('myModule.myFn', { 0: 'a', 1: 'b', length: 2 });
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for myModule.myFn(): ' +
        'Expected <argumentList>[1] to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('throws when given too many arguments', () => {
      function fnWithValidation(x: any, y: any, z: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb: number]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz', 2, 3);
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected the <argumentList> array to have 2 entries, but found 3.',
      });
      assert.throws(act, TypeError);
    });

    test('throws when given too few arguments', () => {
      function fnWithValidation(x: any, y?: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb: number]`.assertArgs(fnWithValidation.name, arguments);
      }
      const act = (): any => fnWithValidation('xyz');
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected the <argumentList> array to have 2 entries, but found 1.',
      });
      assert.throws(act, TypeError);
    });

    test('The thrown error does not have too many unnecessary stack frames in the call stack', () => {
      // Using a nested tuple to force the error to be thrown from deeper, recursive logic.
      const v = validator`[[[[string]]]]`;
      const myUniquelyNamedFn = (): any => v.assertArgs('myFn', [[[[2]]]]);
      assert.throws(myUniquelyNamedFn, (error: Error) => {
        assert(error.stack !== undefined);
        return error.stack.split('\n').slice(0, 6).join('\n').includes('myUniquelyNamedFn');
      });
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
      v.assertMatches('xyz');
    });

    test('forbids string inputs when given a simple number rule', () => {
      const v = validator.fromRule({
        category: 'simple',
        type: 'number',
      });
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
      assert.throws(act, TypeError);
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

      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
      assert.throws(act, TypeError);
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

  describe('validator.checker()', () => {
    test('accepts a value that conforms to the custom validatable function', () => {
      const v = validator`${validator.checker(x => typeof x === 'number' && x >= 0)}`;
      v.assertMatches(2);
    });

    test('rejects a value that does not conform to the custom validatable function', () => {
      const v = validator`${validator.checker(x => typeof x === 'number' && x >= 0)}`;
      const act = (): any => v.assertMatches(-2);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which is -2, to match a custom validity checker.'
        ),
      });
      assert.throws(act, TypeError);
    });

    test('you can give your validatable object a custom description for error messages to use', () => {
      const v = validator`${validator.checker(x => typeof x === 'number' && x >= 0, { to: 'be positive' })}`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue>, which is "xyz", to be positive' });
      assert.throws(act, TypeError);
    });

    test('you can move the custom validatable protocol to your own class', () => {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class MyValidatable {
        static [validator.validatable] = validator.checker(x => typeof x === 'string').protocolFn;
      }

      const v = validator`${MyValidatable}`;
      v.assertMatches('xyz');
      const act = (): any => v.assertMatches(2);
      assert.throws(act, { message: 'Expected <receivedValue>, which is 2, to match a custom validity checker.' });
      assert.throws(act, TypeError);
    });
  });

  test('forbids outside users from instantiating ValidatorSyntaxError', () => {
    const act = (): any => new (ValidatorSyntaxError as any)('Whoops!');
    assert.throws(act, (err: Error) => err.constructor === Error);
    assert.throws(act, { message: 'The ValidatorSyntaxError constructor is private.' });
  });
});
