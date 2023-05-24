/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';
import { testableHelpers as cacheApi } from '../src/cacheControl';

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
      assert.throws(act, {
        message: [
          (
            'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
            'One of the following issues needs to be resolved:'
          ),
          '  * Expected <2nd argument>.errorPrefix to be of type "undefined" but got type "string".',
          '  * Expected <2nd argument>.errorPrefix, which was "Error in some place.", to end with a colon.',
        ].join('\n'),
      });
      assert.throws(act, TypeError);
    });

    test('able to provide an error subclass with the errorFactory parameter', () => {
      class MyError extends Error {}
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, { errorFactory: (...args: any) => new MyError(...args) });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, MyError);
    });

    test('able to provide a modified error object with the errorFactory parameter', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, {
        errorFactory: (...args: any) => {
          const error = new Error(...args);
          (error as any).key = 'MY_KEY';
          return error;
        },
      });
      assert.throws(act, {
        message: 'Expected <receivedValue> to be of type "string" but got type "number".',
        key: 'MY_KEY',
      });
    });

    test('able to explicitly supply undefined "at" and "errorFactory" parameters', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2, { at: undefined, errorPrefix: undefined, errorFactory: undefined });
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
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
      assert.throws(act, {
        message: [
          (
            'Received invalid "opts" argument for <validator instance>.assertionTypeGuard(): ' +
            'One of the following issues needs to be resolved:'
          ),
          '  * Expected <2nd argument>.errorPrefix to be of type "undefined" but got type "string".',
          '  * Expected <2nd argument>.errorPrefix, which was "Error in some place.", to end with a colon.',
        ].join('\n'),
      });
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
      assert.throws(act, TypeError);
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
        validator`[myStr: string, myNumb: number]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for fnWithValidation(): ' +
        'Expected <2nd argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against a tuple without named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[string, number]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected <2nd argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against an optional entry of a tuple with named entries', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb?: number]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for fnWithValidation(): ' +
        'Expected <2nd argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against the "rest" entries of a tuple with named entries (test 1)', () => {
      function fnWithValidation(a: any, b: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, ...myNumbs: number[]]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumbs" arguments for fnWithValidation(): ' +
        'Expected <2nd argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when failing to match against the "rest" entries of a tuple with named entries (test 2)', () => {
      function fnWithValidation(a: any, b: any, c: any, d: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, ...myNumbs: number[]]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 1, 2, 'abc');
      assert.throws(act, {
        message: 'Received invalid "myNumbs" arguments for fnWithValidation(): ' +
        'Expected <4th argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('gives the right error when matching against a non-tuple', () => {
      function fnWithValidation(x: any, y: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`string[]`.assertArgs('fnWithValidation()', arguments);
      }
      const act = (): any => fnWithValidation('xyz', 2);
      assert.throws(act, {
        message: 'Received invalid arguments for fnWithValidation(): ' +
        'Expected <2nd argument> to be of type "string" but got type "number".',
      });
      assert.throws(act, TypeError);
    });

    test('accepts any array-like object', () => {
      const v = validator`[myStr: string, myNumb: number]`;
      const act = (): any => v.assertArgs('myModule.myFn()', { 0: 'a', 1: 'b', length: 2 });
      assert.throws(act, {
        message: 'Received invalid "myNumb" argument for myModule.myFn(): ' +
        'Expected <2nd argument> to be of type "number" but got type "string".',
      });
      assert.throws(act, TypeError);
    });

    test('accepts sparse arrays array-like objects', () => {
      const act = (): any => validator`[string, number, string]`.assertArgs('myFn()', { 0: 'x', 2: 'y', length: 3 });
      assert.throws(act, {
        message: (
          'Received invalid arguments for myFn(): ' +
          'Expected <2nd argument> to be of type "number" but got type "undefined".'
        ),
      });
    });

    test('accepts sparse arrays', () => {
      // eslint-disable-next-line no-sparse-arrays
      const act = (): any => validator`[string, number, string]`.assertArgs('myFn()', ['x', , 'y']);
      assert.throws(act, {
        message: (
          'Received invalid arguments for myFn(): ' +
          'Expected <2nd argument> to be of type "number" but got type "undefined".'
        ),
      });
    });

    test('throws when given too many arguments', () => {
      function fnWithValidation(x: any, y: any, z: any): void {
        // eslint-disable-next-line prefer-rest-params
        validator`[myStr: string, myNumb: number]`.assertArgs('fnWithValidation()', arguments);
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
        validator`[myStr: string, myNumb: number]`.assertArgs('fnWithValidation()', arguments);
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
      const myUniquelyNamedFn = (): any => v.assertArgs('myFn()', [[[[2]]]]);
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
    test('converts a string to a validator', () => {
      const v = validator.from('string');
      expect(v.matches('xyz')).toBe(true);
      expect(v.matches(2)).toBe(false);
    });

    test('returns validator instances as-is', () => {
      const v1 = validator`string`;
      const v2 = validator.from(v1);
      expect(v1).toBe(v2);
    });
  });

  describe('validator.fromRuleset()', () => {
    test('allows string inputs when given a simple string rule', () => {
      const v = validator.fromRuleset({
        rootRule: {
          category: 'simple',
          type: 'string',
        },
        interpolated: [],
      });
      v.assertMatches('xyz');
    });

    test('forbids string inputs when given a simple number rule', () => {
      const v = validator.fromRuleset({
        rootRule: {
          category: 'simple',
          type: 'number',
        },
        interpolated: [],
      });
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "string".' });
      assert.throws(act, TypeError);
    });

    test('allow providing interpolated values', () => {
      const v = validator.fromRuleset({
        rootRule: {
          category: 'interpolation',
          interpolationIndex: 0,
        },
        interpolated: [2],
      });
      expect(v.matches(2)).toBe(true);
      expect(v.matches(3)).toBe(false);
    });

    test('validator behavior does not change, even if input ruleset is mutated', () => {
      const ruleset = {
        rootRule: {
          category: 'interpolation' as const,
          interpolationIndex: 0,
        },
        interpolated: [2],
      };

      const v = validator.fromRuleset(ruleset);
      (ruleset as any).rootRule.interpolationIndex = 1;
      (ruleset as any).interpolated.pop();

      // Just making sure it actually mutates, and that fromRuleset didn't freeze the input object.
      expect(ruleset.rootRule.interpolationIndex).toBe(1);
      expect(ruleset.interpolated).toMatchObject([]);

      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got "xyz".' });
      assert.throws(act, TypeError);
    });

    test('able to create a validator from a complex ruleset', () => {
      const v = validator`[
        { x: 2, [${3}]: 4, [index: string]: 5 },
        [a: 1, b?: 2, ...rest: 3[]],
        4[],
        2 & 3,
        2 | 3,
        ${validator`{}`},
        ${validator.lazy(() => validator`{}`)},
        ${validator.expectTo(() => null)},
        ${Map},
        ${2},
        string@<string>,
        number,
        null,
        object,
        unknown,
      ]`;

      validator.fromRuleset(v.ruleset);
    });
  });

  describe('validator.lazy()', () => {
    test('enables self-referencing patterns', () => {
      const lazyCons = validator.lazy(() => v);
      const v = validator`{ value: unknown, next: ${lazyCons} } | null`;

      expect(v.matches(null)).toBe(true);
      expect(v.matches({ value: 1, next: null })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: null } })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: { value: 3, next: null } } })).toBe(true);
      expect(v.matches({ value: 1, next: { value: 2, next: { value: 3, next: 'xyz' } } })).toBe(false);
    });

    test('it receives the value being matched as an argument', () => {
      let value;
      const lazyError = validator.lazy(value_ => {
        value = value_;
        return validator`unknown`;
      });
      const v = validator`{ sub: ${lazyError} }`;
      v.matches({ sub: 2 });
      expect(value).toBe(2);
    });

    test('it does not execute the callback if earlier validation checks failed', () => {
      const lazyError = validator.lazy(() => {
        throw new Error('I should not be called');
      });
      const v = validator`'I am this exact string' & ${lazyError}`;
      v.matches('I am not the expected string');
    });

    test('LazyEvaluator instance is frozen', () => {
      const lazyValidator = validator.lazy(() => validator`0`);
      expect(Object.isFrozen(lazyValidator)).toBe(true);
    });
  });

  describe('validator.expectTo()', () => {
    test('accepts a value that conforms to the custom expectation', () => {
      const v = validator`${validator.expectTo(x => typeof x === 'number' && x >= 0 ? null : 'be positive.')}`;
      v.assertMatches(2);
    });

    test('rejects a value that does not conform to the custom expectation', () => {
      const v = validator`${validator.expectTo(x => typeof x === 'number' && x >= 0 ? null : 'be positive.')}`;
      const act = (): any => v.assertMatches(-2);
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was -2, to be positive.',
      });
      assert.throws(act, TypeError);
    });

    test('expectation instance is frozen', () => {
      const expectation = validator.expectTo(() => null);
      expect(Object.isFrozen(expectation)).toBe(true);
    });

    test('Passed-in values that are long strings will be truncated in error messages', () => {
      const v = validator`${validator.expectTo(x => 'fail.')}`;
      const act = (): any => v.assertMatches(
        'abcdefghijklmnopqrstuvwzyz ABCDEFGHIJKLMNOPQRSTUVWZYZ 1234567890' +
        'abcdefghijklmnopqrstuvwzyz ABCDEFGHIJKLMNOPQRSTUVWZYZ 1234567890',
      );
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was "abcdefghijklmnopqrstuvwzyz ABCDEFGHIJKLMNOPQRSTUVW…", to fail.',
      });
    });
  });

  test('forbids outside users from instantiating ValidatorSyntaxError', () => {
    const act = (): any => new (ValidatorSyntaxError as any)('Whoops!');
    assert.throws(act, (err: Error) => err.constructor === Error);
    assert.throws(act, { message: 'The ValidatorSyntaxError constructor is private.' });
  });

  describe('cache', () => {
    // This test also shows that the cache does not care about what gets interpolated in.
    // And its able to handle special characters.
    test('Using the validator template tag adds the parsed result to the cache', () => {
      expect(cacheApi.getCacheEntryFor`[${null}, 'cacheme\n']`.exists()).toBe(false);
      validator`[${2}, 'cacheme\n']`;
      expect(cacheApi.getCacheEntryFor`[${null}, 'cacheme\n']`.exists()).toBe(true);
      expect(cacheApi.getCacheEntryFor`[${null}, 'cacheme\n']`.get()).toMatchObject({
        category: 'tuple',
        content: [
          {
            category: 'interpolation',
            interpolationIndex: 0,
          }, {
            category: 'primitiveLiteral',
            value: 'cacheme\n',
          },
        ],
        optionalContent: [],
        rest: null,
        entryLabels: null,
      });
    });

    // This test also shows that the cache does not care about what gets interpolated in.
    // And its able to handle special characters.
    test('The validator template tag will fetch values from the cache if they are present.', () => {
      cacheApi.getCacheEntryFor`[${null}, 'cacheme\n']`.set({
        category: 'tuple',
        content: [
          {
            category: 'interpolation',
            interpolationIndex: 0,
          }, {
            category: 'primitiveLiteral',
            value: 'aTotallyWrongValue',
          },
        ],
        optionalContent: [],
        rest: null,
        entryLabels: null,
      });

      expect(validator`[${2}, 'cacheme\n']`.ruleset).toMatchObject({
        rootRule: {
          category: 'tuple',
          content: [
            {
              category: 'interpolation',
              interpolationIndex: 0,
            }, {
              category: 'primitiveLiteral',
              value: 'aTotallyWrongValue',
            },
          ],
        },
        interpolated: [2],
      });
    });

    // Since .from() can easily be used with dynamically generated strings,
    // it should bypass the cache to prevent it from hogging all the ram.
    test('Using validator.from() does not add the parsed result to the cache', () => {
      validator.from('"cacheme"');
      expect(cacheApi.getCacheEntryFor`"cacheme"`.exists()).toBe(false);
    });

    // It's not important whether or not validator.from() looks up information from the cache.
    // This test is mostly here to document the current behavior.
    test('validator.from() will not fetch values from the cache if they are present.', () => {
      cacheApi.getCacheEntryFor`"cacheme"`.set({
        category: 'primitiveLiteral',
        value: 'aTotallyWrongValue',
      });

      expect(validator.from('"cacheme"').ruleset).toMatchObject({
        rootRule: {
          category: 'primitiveLiteral',
          value: 'cacheme',
        },
        interpolated: [],
      });
    });

    test('cached result is frozen', () => {
      validator`'cacheme'`;
      const ruleset = validator`'cacheme'`.ruleset;
      expect(Object.isFrozen(ruleset)).toBe(true);
      expect(Object.isFrozen(ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(ruleset.interpolated)).toBe(true);
    });

    test('internal uses of the type checker gets cached', () => {
      expect(cacheApi.getCacheEntryFor`[testExpectation: ${null}]`.exists()).toBe(false);

      // expectTo() takes one argument. Calling expectTo should
      // run the type-checker against the empty the `[testExpectation: <function>]` tuple.
      validator.expectTo(() => null);

      expect(cacheApi.getCacheEntryFor`[testExpectation: ${null}]`.exists()).toBe(true);
    });
  });
});
