/* eslint-disable @typescript-eslint/no-extraneous-class */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable symbol-description */

// Each example found in the documentation has a corresponding test case in here,
// to make sure we're not accidentally making changes to the documented behaviors.

import * as assert from 'node:assert';
import { validator, ValidatorSyntaxError, type Validator } from '../src';

describe('documentation examples', () => {
  describe('README', () => {
    test('it is as easy as...', () => {
      const userValidator = validator`{
        username: string // required string property
        age?: number // optional number property
        dateOfBirth: string | ${Date} // must be a string, or an instance of Date
      }`;

      // ✓ - This is valid.
      userValidator.assertMatches({
        username: 'cookieMonster42',
        dateOfBirth: new Date(1969),
      });

      // ✕ - Expected <receivedValue>.age to be of type "number" but got type "string".
      assert.throws(() => {
        userValidator.assertMatches({
          username: 'elmo77',
          age: "it's a secret",
          dateOfBirth: new Date(1984),
        });
      }, { message: 'Expected <receivedValue>.age to be of type "number" but got type "string".' });
    });

    test('quick start example', () => {
      const v = validator`{
        arrayOfStringsOrNumbers: (string | number)[]
        canBeMissingOrBoolean?: boolean | undefined
        mustBe42: 42
        aOneOrTwoLengthedTupleOfBooleans: [boolean, boolean?]
        stringToNumberMapping: { [index: string]: number }
      
        // Generic matching, like Set<string>, can't be supported the same way
        // it exists in TypeScript. Instead, iterable-matching syntax is provided
        // among other tools to fill this gap.
        mustBeASetThatYieldsStringsWhenIterated: ${Set}@<string>
      }`;

      v.assertMatches({
        arrayOfStringsOrNumbers: ['x', 2],
        canBeMissingOrBoolean: true,
        mustBe42: 42,
        aOneOrTwoLengthedTupleOfBooleans: [false],
        stringToNumberMapping: { a: 1, b: 2 },
        mustBeASetThatYieldsStringsWhenIterated: new Set(['a', 'b']),
      });
    });

    test('interpolation examples', () => {
      // This can only be matched with the number `42`.
      validator`${42}`.assertMatches(42);

      // This will only accept an array of `true`s.
      validator`${true}[]`.assertMatches([true, true, true]);

      class Shape {}
      // Passing in a class (or function, since classes are functions)
      // will require the user to provide an instance of the class.
      validator`${Shape}`.assertMatches(new Shape());

      // You can create more complicated validator instances by composing smaller ones.
      const pointValidator = validator`{ x: number, y: number }`;
      const lineValidator = validator`{ start: ${pointValidator}, end: ${pointValidator} }`;

      // -- extra assertions --

      lineValidator.assertMatches({
        start: { x: 1, y: 2 },
        end: { x: 3, y: 4 },
      });
    });

    test('expectTo() examples', () => {
      // If a string is returned, it'll be used as part of the error message.
      // The strings should complete the sentence: "Expected the value to ..."
      const expectGreaterThanZero = validator.expectTo(
        value => typeof value === 'number' && value > 0
          ? null
          : 'be a number greater than zero.',
      );

      const validatePositivePoint = validator`{
        x: ${expectGreaterThanZero}
        y: ${expectGreaterThanZero}
      }`;

      // ✕ - Expected <receivedValue>.y, which was -2, to be a number greater than zero.
      assert.throws(() => {
        validatePositivePoint.assertMatches({
          x: 2,
          y: -2,
        });
      }, { message: 'Expected <receivedValue>.y, which was -2, to be a number greater than zero.' });
    });
  });

  describe('I want to use generics', () => {
    test('iterable matching syntax', () => {
      // Matches against an instance of Set that holds
      // only strings.
      const mySet = new Set(['a', 'b', 'c']);
      validator`${Set}@<string>`
        .assertMatches(mySet);

      // Matches against an instance of Map that maps
      // strings to coordinates.
      const myMap = new Map([['a', { x: 2, y: 3 }]]);
      validator`${Map}@<[string, { x: number, y: number }]>`
        .assertMatches(myMap);

      // Matches any iterable that yields booleans or numbers
      const myArray = [true, false, 2, false];
      validator`unknown@<boolean | number>`
        .assertMatches(myArray);
    });

    test('validator factories', () => {
      function createCoordinateValidator(type: Validator) {
        return validator`{
          x: ${type}
          y: ${type}
        }`;
      }

      createCoordinateValidator(validator`number`)
        .assertMatches({ x: 2, y: 3 });
    });

    test('validator.from()', () => {
      function createCoordinateValidator(type_: string | Validator) {
        const type = validator.from(type_);
        return validator`{
          x: ${type}
          y: ${type}
        }`;
      }

      // Both of these have the same effect.

      createCoordinateValidator(validator`number`)
        .assertMatches({ x: 2, y: 3 });

      createCoordinateValidator('number')
        .assertMatches({ x: 2, y: 3 });

      // ...

      const lineValidator = validator`{
        start: ${createCoordinateValidator('number')}
        end: ${createCoordinateValidator('number')}
      }`;

      // -- extra assertions --

      lineValidator.assertMatches({
        start: { x: 2, y: 3 },
        end: { x: 4, y: 5 },
      });
    });
  });

  describe('I want to customize assertion error messages', () => {
    const hasUsernameValidator = validator`{ name: string }`;

    test('default error message', () => {
      // TypeError: Expected <receivedValue>.name to be of
      // type "string" but got type "boolean".
      const act = (): any => hasUsernameValidator.assertMatches({ name: false });
      assert.throws(act, { message: 'Expected <receivedValue>.name to be of type "string" but got type "boolean".' });
      assert.throws(act, TypeError);
    });

    test('the `errorPrefix` parameter', () => {
      // TypeError: Error in myConfig.json: Expected
      // <receivedValue>.name to be of type "string" but
      // got type "boolean".
      const act = (): any => hasUsernameValidator.assertMatches({ name: false }, {
        errorPrefix: 'Error in myConfig.json:',
      });
      assert.throws(act, {
        message: 'Error in myConfig.json: Expected <receivedValue>.name to be of type "string" but got type "boolean".',
      });
      assert.throws(act, TypeError);
    });

    test('the `at` parameter', () => {
      const configData = {
        user: { name: false },
      };

      // TypeError: Expected <myConfig.json>.user.name to be
      // of type "string" but got type "boolean."
      const act = (): any => hasUsernameValidator.assertMatches(configData.user, {
        at: '<myConfig.json>.user',
      });
      assert.throws(act, {
        message: 'Expected <myConfig.json>.user.name to be of type "string" but got type "boolean".',
      });
      assert.throws(act, TypeError);
    });

    test('.assertArgs()', () => {
      function getName(userInfo: { name: string }) {
        validator`[userInfo: { name: string }]`
          .assertArgs('getName()', arguments);

        return userInfo.name;
      }

      // TypeError: Received invalid "userInfo" argument for getName():
      // Expected <1st argument>.name to be of type "string" but got type "boolean".
      const act = (): any => getName({ name: false as any });
      assert.throws(act, {
        message: (
          'Received invalid "userInfo" argument for getName(): ' +
          'Expected <1st argument>.name to be of type "string" but got type "boolean".'
        ),
      });
      assert.throws(act, TypeError);
    });

    test('spread and destructure with .assertArgs()', () => {
      function getName(...allArgs: [userInfo: { name: string }]) {
        const [userInfo] = allArgs;
        validator`[userInfo: { name: string }]`
          .assertArgs('getName()', allArgs);

        return userInfo.name;
      }

      // -- Testing against the same assertions as the earlier example --

      // TypeError: Received invalid "userInfo" argument for getName():
      // Expected <1st argument>.name to be of type "string" but got type "boolean".
      const act = (): any => getName({ name: false as any });
      assert.throws(act, {
        message: (
          'Received invalid "userInfo" argument for getName(): ' +
          'Expected <1st argument>.name to be of type "string" but got type "boolean".'
        ),
      });
      assert.throws(act, TypeError);
    });

    test('allowing extra args', () => {
      const v = validator`[userInfo: { name: string }, ...etc: unknown]`;

      // -- extra assertions --

      v.assertArgs('example()', [{ name: 'abc' }, 2, 3, 4]);
    });
  });

  describe('I want to create circular references', () => {
    test('.lazy()', () => {
      const linkedListNodeValidator = validator`{
        value: unknown
        next: ${validator.lazy((): any => linkedListNodeValidator)} | null
      }`;

      // Example valid data
      linkedListNodeValidator.assertMatches({
        value: 1,
        next: {
          value: 2,
          next: null,
        },
      });
    });
  });

  describe('syntax reference', () => {
    test('simple rules', () => {
      validator`number`.assertMatches(2); // ✓
      validator`bigint`.assertMatches(2n); // ✓
      validator`null`.assertMatches(null); // ✓

      validator`object`.assertMatches({ x: 2 }); // ✓
      validator`object`.assertMatches([2, 3]); // ✓
      validator`object`.assertMatches(() => {}); // ✓

      assert.throws(() => {
        validator`object`.assertMatches(null); // ✕
      }, TypeError);
    });

    test('primitive literal rules', () => {
      validator`'Hello World!'`.assertMatches('Hello World!'); // ✓
      validator`-2`.assertMatches(-2); // ✓
      validator`0xFF`.assertMatches(255); // ✓
      validator`Infinity`.assertMatches(Infinity); // ✓
      validator`2n`.assertMatches(2n); // ✓
      validator`true`.assertMatches(true); // ✓
    });

    test('any/unknown no-op rules', () => {
      validator`unknown`.assertMatches(2); // ✓
      validator`unknown`.assertMatches({ x: 2 }); // ✓
      validator`unknown`.assertMatches(new Date()); // ✓

      validator`any`.assertMatches(2); // ✓
      validator`any`.assertMatches({ x: 2 }); // ✓
      validator`any`.assertMatches(new Date()); // ✓
    });

    test('object rules', () => {
      // ✓
      validator`{
        myNumb: number
        myOptionalString?: string
      }`.assertMatches({ myNumb: 4, extraProp: true });
    });

    test('object rules - property separators', () => {
      // ✓
      validator`{
        a: 1
        b: 2,
        c: 3;
      }`.assertMatches({ a: 1, b: 2, c: 3 });
    });

    test('object rules - special keys', () => {
      const mySymbol = Symbol();

      // ✓
      validator`{
        'special key': number
        [${mySymbol}]: number
      }`.assertMatches({ 'special key': 1, [mySymbol]: 2 });
    });

    test('object rules - index signature', () => {
      validator`{ [dimension: string]: number }`
        .assertMatches({ x: 2, y: 3 }); // ✓

      assert.throws(() => {
        validator`{ [index: symbol]: number }`
          .assertMatches({ x: 'xyz', [Symbol()]: 'xyz' }); // ✕
      }, TypeError);
    });

    test('array rules', () => {
      validator`number[]`
        .assertMatches([2, 3.5, Infinity]); // ✓

      assert.throws(() => {
        validator`number[]`
          .assertMatches([2, 'this is not a number']); // ✕
      }, TypeError);

      assert.throws(() => {
        validator`number[]`
          .assertMatches({ 0: 2, 1: 3.5, length: 2 }); // ✕
      }, TypeError);
    });

    test('tuple rules', () => {
      validator`[number, string]`
        .assertMatches([2, 'a string']); // ✓

      validator`[number, boolean?, string?]`
        .assertMatches([2, true]); // ✓

      validator`[boolean, ...number[]]`
        .assertMatches([true, 1, 2, 3, 4]); // ✓
    });

    test('tuple rules - with labels', () => {
      validator`[someNumb: number, someStr: string]`
        .assertMatches([2, 'a string']); // ✓

      validator`[someNumb: number, optionalBool?: boolean, alsoOptional?: string]`
        .assertMatches([2, true]); // ✓

      validator`[someFlag: boolean, ...otherNumbs: number[]]`
        .assertMatches([true, 1, 2, 3, 4]); // ✓
    });

    test('union rules', () => {
      validator`number | string`
        .assertMatches(2); // ✓
    });

    test('intersection rules', () => {
      validator`{ x: number } & { y: number }`
        .assertMatches({ x: 2, y: 3 }); // ✓

      assert.throws(() => {
        validator`{ x: number } & { y: number }`
          .assertMatches({ x: 2 }); // ✕
      }, TypeError);
    });

    test('iterable rules', () => {
      // Iterates over the map instance and ensures each
      // yielded entry matches the `[string, number]` pattern,
      // thus verifying that this maps strings to numbers.
      const myMap = new Map([['a', 1], ['b', 2]]);
      validator`${Map}@<[string, number]>`
        .assertMatches(myMap);
    });

    test('parentheses', () => {
      validator`(number | string)[]`
        .assertMatches([2, 'x', 3]); // ✓
    });

    test('comments', () => {
      validator`{
        x: number
        // y: number
        /* z: number */
      }`.assertMatches({ x: 3 }); // ✓
    });

    test('comments across interpolation points', () => {
      // -- preparation --

      let logged = '';
      const console = {
        log(message: string) {
          logged += message + '\n';
        },
      };

      // -- documented example --

      const logAndReturn = () => {
        console.log('Hi There');
        return 5;
      };

      validator`{
        x: 3
        // y: ${logAndReturn()}
      }`.assertMatches({ x: 3 }); // ✓ - "Hi There" is still logged out

      // -- extra assertions --

      expect(logged).toEqual('Hi There\n');
    });
  });

  describe('api reference', () => {
    test('the validator template tag', () => {
      const validatorInstance = validator`{ x: number, y: number }`;
    });

    test('the validator template tag with a generic parameter', () => {
      const validateString = validator<string>`string`;
    });

    test('ValidatorSyntaxError', () => {
      // -- preparation --

      let logged = '';
      const console = {
        error(...messages: string[]) {
          logged += messages.join(' ') + '\n';
        },
      };

      // -- documented example --

      try {
        validator`[number string]`;
      } catch (error) {
        if (error instanceof ValidatorSyntaxError) {
          console.error('Syntax Error:', error.message);
          // -- Output --
          // Syntax Error: Expected a comma (`,`) or closing bracket (`]`). (line 1, col 9)
          //   [number string]
          //           ~~~~~~
        } else {
          throw error;
        }
      }

      // -- extra assertions --

      expect(logged).toEqual([
        'Syntax Error: Expected a comma (`,`) or closing bracket (`]`). (line 1, col 9)',
        '  [number string]',
        '          ~~~~~~',
        '',
      ].join('\n'));
    });

    test('validator.expectTo()', () => {
      const expectNonEmptyArray = validator.expectTo(
        unknownValue => Array.isArray(unknownValue) && unknownValue.length > 0
          ? null
          : 'be an empty array.',
      );

      const parentValidator = validator`{
        name: string
        children: string[] & ${expectNonEmptyArray}
      }`;

      // ✓
      parentValidator.assertMatches({
        name: 'Billy',
        children: ['Sally', 'Sam'],
      });

      // ✕ - Expected <receivedValue>.children, which was [object Array],
      //     to be an empty array.
      assert.throws(() => {
        parentValidator.assertMatches({
          name: 'Bob',
          children: [],
        });
      }, { message: 'Expected <receivedValue>.children, which was [object Array], to be an empty array.' });
    });

    test('validatorInstance.expectTo() with pre-conditions', () => {
      // Before using this expectation, make sure you've already
      // validated that the value is an array. If you don't,
      // this expectation may throw, because it will try to access
      // a `length` property that may not exist on the value.
      const andExpectNonEmptyArray = validator.expectTo(
        (array: any) => array.length > 0
          ? null
          : 'be an empty array.',
      );

      const parentValidator = validator`{
        name: string
        // First validate that 'children' is an array of strings.
        // After that, we've satisfied the custom expectation's pre-condition
        // so we're ok to use it to check if the array is non-empty.
        children: string[] & ${andExpectNonEmptyArray}
      }`;

      // -- extra assertions --

      // ✓
      parentValidator.assertMatches({
        name: 'Billy',
        children: ['Sally', 'Sam'],
      });
    });

    test('validatorInstance.assertMatches()', () => {
      const errorFactory = (...args: any) => {
        const myError: any = new Error(...args);
        myError.code = 'VALIDATION_FAILED';
        return myError;
      };

      // ✕ - An instance of `Error` containing a code property set to "VALIDATION_FAILED"
      //     will be thrown.
      assert.throws(() => {
        validator`number`
          .assertMatches('a string', { errorFactory });
      }, { code: 'VALIDATION_FAILED' });
    });

    test('validatorInstance.assertionTypeGuard()', () => {
      // -- preparation --

      const console = { log(message: string) {} };

      // -- documented example --

      // For the type-narrowing to work, you must supply a type parameter
      // to the validator, either with the `Validator<...>` type, or
      // by creating a parameterized validator instance and using it immediately,
      // like this: validator<...>`...`.assertionTypeGuard(...).
      const validateNumber: Validator<string> = validator`string`;

      const unknownValue: unknown = 'Hi There!';

      // Assert that `unknownValue` is, in fact, a string
      validateNumber.assertionTypeGuard(unknownValue);

      // Now TypeScript will let you use unknownValue as a string, because
      // we just proved it was.
      console.log(unknownValue.slice(3));
    });
  });

  describe('recipes', () => {
    test('expectRef()', () => {
      function expectRef(expectedRef: object) {
        return validator.expectTo((value: unknown) => {
          return value === expectedRef
            ? null
            : `to be the same object as ${String(expectedRef)}`;
        });
      }

      // Example usage
      const myRef = {};
      validator`${expectRef(myRef)}`.assertMatches(myRef); // ✓
      assert.throws(() => {
        validator`${expectRef(myRef)}`.assertMatches({}); // ✕
      }, {
        message: 'Expected <receivedValue>, which was [object Object], to to be the same object as [object Object]',
      });
    });

    test('expectCloseTo()', () => {
      // ✕ - Expected <receivedValue> to be 0.3
      //     but got 0.30000000000000004.
      assert.throws(() => {
        validator`0.3`.assertMatches(0.1 + 0.1 + 0.1);
      }, { message: 'Expected <receivedValue> to be 0.3 but got 0.30000000000000004.' });

      function expectCloseTo(target: number, { plusOrMinus }: { plusOrMinus: number }) {
        return validator.expectTo(value =>
          typeof value === 'number' && Math.abs(target - value) < plusOrMinus
            ? null
            : `be equal to ${target}±${plusOrMinus}`,
        );
      }

      // ✓
      validator`${expectCloseTo(0.3, { plusOrMinus: 1e-10 })}`
        .assertMatches(0.1 + 0.1 + 0.1);
    });

    test('expectDirectInstance() - how it behaves without it', () => {
      class MyMap extends Map {}

      validator`${Map}`.assertMatches(new Map()); // ✓
      validator`${Map}`.assertMatches(new MyMap()); // ✓
    });

    test('expectDirectInstance()', () => {
      function expectDirectInstance(TargetClass: (new (...params: any) => any)) {
        return validator.expectTo((value: unknown) => {
          const isDirectInstance = Object(value).constructor === TargetClass;
          return isDirectInstance ? null : `be a direct instance of ${TargetClass.name}.`;
        });
      }

      // Example usage
      class MyMap extends Map {}
      validator`${expectDirectInstance(Map)}`.assertMatches(new Map()); // ✓
      assert.throws(() => {
        validator`${expectDirectInstance(Map)}`.assertMatches(new MyMap()); // ✕
      }, { message: 'Expected <receivedValue>, which was [object MyMap], to be a direct instance of Map.' });
    });

    test('expectNonSparse()', () => {
      const expectNonSparse = validator.expectTo((array: unknown) => {
        if (!Array.isArray(array)) return null;
        for (let i = 0; i < array.length; i++) {
          if (!(i in array)) {
            return `not be a sparse array. Found a hole at index ${i}.`;
          }
        }

        return null;
      });

      // Example usage
      validator`${expectNonSparse}`.assertMatches([2, undefined, 3]); // ✓
      assert.throws(() => {
        // eslint-disable-next-line no-sparse-arrays
        validator`${expectNonSparse}`.assertMatches([2, , 3]); // ✕
      }, {
        message: (
          'Expected <receivedValue>, which was [object Array], to not be a sparse array. ' +
          'Found a hole at index 1.'
        ),
      });
    });
  });

  describe('multi-step validation', () => {
    test('with .lazy()', () => {
      const andExpectKeysToBePresent = (keys: string[]) => validator.expectTo((object: any) => {
        const invalidKey = keys.find(key => !(key in object));
        return invalidKey === undefined ? null : `have the key ${invalidKey}.`;
      });

      const csvDataValidator = validator`
        {
          metadata: {
            keys: string[]
          }
        } & ${validator.lazy((csvData: any) => {
          const keys = csvData.metadata.keys;
          return validator`{
            entries: (object & ${andExpectKeysToBePresent(keys)})[]
          }`;
        })}
      `;

      // -- extra assertions --

      csvDataValidator.assertMatches({
        metadata: { keys: ['a', 'b'] },
        entries: [{ a: 1, b: 2 }, { a: 3, b: 4 }],
      });

      assert.throws(() => {
        csvDataValidator.assertMatches({
          metadata: { keys: ['a', 'b'] },
          entries: [{ a: 1, b: 2 }, { a: 3 }],
        });
      }, { message: 'Expected <receivedValue>.entries[1], which was [object Object], to have the key b.' });
    });

    test('with .expectTo()', () => {
      const csvDataValidator = validator`{
        metadata: {
          count: number
        }
        entries: object[]
      } & ${validator.expectTo(
        (csvData: any) => csvData.entries.length === csvData.metadata.count
          ? null
          : "have an '.entries' property with a length equal to '.metadata.count'.",
      )}`;

      // -- extra assertions --

      csvDataValidator.assertMatches({
        metadata: { count: 2 },
        entries: [{ x: 1 }, { x: 2 }],
      });

      assert.throws(() => {
        csvDataValidator.assertMatches({
          metadata: { count: 3 },
          entries: [{ x: 1 }, { x: 2 }],
        });
      }, {
        message: (
          'Expected <receivedValue>, which was [object Object], to have an ' +
          "'.entries' property with a length equal to '.metadata.count'."
        ),
      });
    });
  });

  describe('type transformers', () => {
    test('array of strings shape', () => {
      expect(validator`string[]`.ruleset).toMatchObject(
        {
          rootRule: {
            category: 'array',
            content: {
              category: 'simple',
              type: 'string',
            },
          },
          interpolated: [],
        },
      );
    });

    test('extract type from array rule', () => {
      function typeOfArrayContent(ruleset: any) {
        // 1. Verify that the passed-in ruleset represents an array
        if (ruleset.rootRule.category !== 'array') {
          throw new Error('This transformer only accepts array types.');
        }

        // 2. Extract the "content" from the array rule
        const contentRule = ruleset.rootRule.content;

        // 3. Built the new ruleset
        return {
          rootRule: contentRule,
          // Preserve the original interpolated array
          interpolated: ruleset.interpolated,
        };
      }

      // ✓
      validator.fromRuleset(
        typeOfArrayContent(validator`string[]`.ruleset),
      ).assertMatches('my string');

      // ✓
      validator.fromRuleset(
        typeOfArrayContent(validator`${42}[]`.ruleset),
      ).assertMatches(42);
    });
  });
});
