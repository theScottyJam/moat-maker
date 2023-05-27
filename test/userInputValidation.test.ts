/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import * as vm from 'node:vm';
import { strict as assert } from 'node:assert';
import { validator, type PropertyRule, type Ruleset } from '../src/index.js';
import { DISABLE_PARAM_VALIDATION } from '../src/config.js';

// These are not meant to be comprehensive tests, rather,
// they're simple smoke tests to make sure the validation checks
// aren't completely busted.

(DISABLE_PARAM_VALIDATION ? describe.skip : describe)('user input validation for validator API', () => {
  test('TypeErrors are thrown when bad input is given', () => {
    const act = (): any => validator(42 as any);
    assert.throws(act, TypeError);
  });

  test('validator template tag', () => {
    const act = (): any => validator(42 as any);
    assert.throws(act, {
      message: (
        'Received invalid "parts" argument for validator`...`: ' +
        '<1st argument> is missing the required properties: "raw"'
      ),
    });
  });

  test('<validator instance>.assertMatches()', () => {
    const act = (): any => (validator`string`.assertMatches as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
        'Expected <2nd argument>, which was 42, to be a direct instance of `Object`.'
      ),
    });
  });

  test('<validator instance>.assertMatches() with subclassed function', () => {
    class MyFunction extends Function {}
    const act = (): any => validator`string`.assertMatches('someValue', {
      errorFactory: new MyFunction() as any,
    });
    assert.throws(act, {
      message: [
        (
          'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
          'One of the following issues needs to be resolved:'
        ),
        '  * Expected <2nd argument>.errorFactory to be of type "undefined" but got a function.',
        '  * Expected <2nd argument>.errorFactory, which was `anonymous`, to be a direct instance of `Function`.',
      ].join('\n'),
    });
  });

  test('<validator instance>.assertMatches() with bad a bad errorFactory()', () => {
    const act = (): any => validator`boolean`.assertMatches('bad value', {
      errorFactory: () => 42 as any,
    });

    assert.throws(act, {
      message: [
        (
          '<validator instance>.assertMatches() received a bad "errorFactory" function: ' +
          'Expected <errorFactory return value>, which was 42, to be an instance of `Error`.'
        ),
        '',
        'The errorFactory() callback was supposed to build an error instance for the following error:',
        'Expected <receivedValue> to be of type "boolean" but got type "string".',
      ].join('\n'),
    });
  });

  test('<validator instance>.assertionTypeGuard()', () => {
    const act = (): any => (validator`string`.assertionTypeGuard as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertionTypeGuard(): ' +
        'Expected <2nd argument>, which was 42, to be a direct instance of `Object`.'
      ),
    });
  });

  test('<validator instance>.assertionTypeGuard() with bad a bad errorFactory()', () => {
    const act = (): any => validator`boolean`.assertionTypeGuard('bad value', {
      errorFactory: () => 42 as any,
    });

    assert.throws(act, {
      message: [
        (
          '<validator instance>.assertionTypeGuard() received a bad "errorFactory" function: ' +
          'Expected <errorFactory return value>, which was 42, to be an instance of `Error`.'
        ),
        '',
        'The errorFactory() callback was supposed to build an error instance for the following error:',
        'Expected <receivedValue> to be of type "boolean" but got type "string".',
      ].join('\n'),
    });
  });

  test('<validator instance>.assertArgs() (test 1)', () => {
    const act = (): any => validator`string`.assertArgs('myFn()', { length: 2.5 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <2nd argument>, which was [object Object], to be array-like.'
      ),
    });
  });

  test('<validator instance>.assertArgs() (test 2)', () => {
    const act = (): any => validator`string`.assertArgs('myFn()', { length: -2 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <2nd argument>, which was [object Object], to be array-like.'
      ),
    });
  });

  test('<validator instance>.matches()', () => {
    const act = (): any => (validator`string`.matches as any)();
    assert.throws(act, {
      message: (
        'Received invalid arguments for <validator instance>.matches(): ' +
        'Expected the <argumentList> array to have 1 entry, but found 0.'
      ),
    });
  });

  test('validator.fromRuleset', () => {
    const act = (): any => validator.fromRuleset({
      rootRule: {
        category: 'union',
        variants: [{
          category: 'array',
          content: {
            category: 'intersection',
            variants: [
              {
                category: 'interpolation',
                interpolationIndex: 0,
              }, {
                category: 'nonsenseCategory' as any,
              },
            ],
          },
        }],
      },
      interpolated: ['xyz'],
    });

    assert.throws(act, {
      message: (
        'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
        'Expected <1st argument>.rootRule.variants[0].content.variants[1].category to be "noop" but got "nonsenseCategory".'
      ),
    });
  });

  test('validator.from()', () => {
    const act = (): any => validator.from(42 as any);
    assert.throws(act, {
      message: [
        (
          'Received invalid "stringOrValidator" argument for validator.from(): ' +
          'One of the following issues needs to be resolved:'
        ),
        '  * Expected <1st argument> to be of type "string" but got type "number".',
        '  * Expected <1st argument>, which was 42, to be a validator instance.',
      ].join('\n'),
    });
  });

  test('A validator returned from validator.from() input checking on its methods', () => {
    const v = validator.from('string');
    const act = (): any => v.assertMatches('bad', 'arguments' as any);
    assert.throws(act, {
      message: [
        (
          'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
          'One of the following issues needs to be resolved:'
        ),
        '  * Expected <2nd argument>.at to be of type "undefined" but got a function.',
        '  * Expected <2nd argument>.at to be of type "string" but got a function.',
      ].join('\n'),
    });
  });

  test('validator.lazy()', () => {
    const act = (): any => (validator.lazy as any)(42);
    assert.throws(act, {
      message: (
        'Received invalid "deriveValidator" argument for validator.lazy(): ' +
        'Expected <1st argument>, which was 42, to be a direct instance of `Function`.'
      ),
    });
  });

  test('validator.lazy() with bad deriveValidator callback', () => {
    const badLazyEvaluator = (validator.lazy as any)(() => 42);
    const v = validator`${badLazyEvaluator}`;
    const act = (): any => v.matches(0);
    assert.throws(act, {
      message: (
        'validator.lazy() received a bad "deriveValidator" function: ' +
        'Expected <deriveValidator return value>, which was 42, to be a validator instance.'
      ),
    });
  });

  test('validator.lazy() with subclassed function', () => {
    class MyFunction extends Function {}
    const act = (): any => validator.lazy(new MyFunction() as any);
    assert.throws(act, {
      message: (
        'Received invalid "deriveValidator" argument for validator.lazy(): ' +
        'Expected <1st argument>, which was `anonymous`, to be a direct instance of `Function`.'
      ),
    });
  });

  test('validator.expectTo()', () => {
    const act = (): any => validator.expectTo(42 as any);
    assert.throws(act, {
      message: (
        'Received invalid "testExpectation" argument for validator.expectTo(): ' +
        'Expected <1st argument>, which was 42, to be a direct instance of `Function`.'
      ),
    });
  });

  test('validator.expectTo() with bad doCheck callback', () => {
    const badExpectation = validator.expectTo(() => 2 as any);
    const act = (): any => validator`${badExpectation}`.matches(2);
    assert.throws(act, {
      message: [
        (
          'validator.expectTo() received a bad "testExpectation" function: ' +
          'One of the following issues needs to be resolved:'
        ),
        '  * Expected <testExpectation return value> to be of type "string" but got type "number".',
        '  * Expected <testExpectation return value> to be of type "undefined" but got type "number".',
      ].join('\n'),
    });
  });

  test('validator.expectTo() with subclassed function', () => {
    class MyFunction extends Function {}
    const act = (): any => validator.expectTo(new MyFunction() as any);
    assert.throws(act, {
      message: (
        'Received invalid "testExpectation" argument for validator.expectTo(): ' +
        'Expected <1st argument>, which was `anonymous`, to be a direct instance of `Function`.'
      ),
    });
  });

  // This tests expectations that are applied to every user-supplied object and array that gets validated.
  describe('object and array restrictions', () => {
    test('can not supply an inherited object where a plain object is expected', () => {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class MyThing {}
      const act = (): any => validator.fromRuleset(Object.assign(new MyThing(), {
        rootRule: { category: 'noop' as const },
        interpolated: [],
      }));

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>, which was [object MyThing], to be a direct instance of `Object`.'
        ),
      });
    });

    test('can not supply an object with extra properties', () => {
      const act = (): any => validator.fromRuleset({
        rootRule: { category: 'noop' },
        interpolated: [],
        'extra key': true,
      } as any);

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>, which was [object Object], to have only known keys. "extra key" is not recognized as a valid key.'
        ),
      });
    });

    test('can not supply an object with extra properties, even if the property is non-enumerable', () => {
      const ruleset = {
        rootRule: { category: 'noop' as const },
        interpolated: [],
      };
      Object.defineProperty(ruleset, 'extra key', { enumerable: false, value: true });
      const act = (): any => validator.fromRuleset(ruleset);

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>, which was [object Object], to have only known keys. "extra key" is not recognized as a valid key.'
        ),
      });
    });

    test('can supply an object with extra, unknown symbol properties', () => {
      // No error should be thrown.
      validator.fromRuleset({
        rootRule: { category: 'noop' as const },
        interpolated: [],
        [Symbol('extra key')]: true,
      });
    });

    test('can not supply an inherited array where a plain array is expected', () => {
      class MyArray extends Array {}
      const act = (): any => validator.fromRuleset({
        rootRule: { category: 'noop' },
        interpolated: new MyArray(),
      });

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>.interpolated, which was [object MyArray], to be a direct instance of `Array`.'
        ),
      });
    });

    test('can not supply sparse arrays', () => {
      const act = (): any => validator.fromRuleset({
        rootRule: { category: 'noop' },
        interpolated: [2, , 3], // eslint-disable-line no-sparse-arrays
      });

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>.interpolated, which was [object Array], to ' +
          'not be a sparse array. Found a hole at index 1.'
        ),
      });
    });
  });

  describe('invalid interpolated values', () => {
    // TODO: Eventually it would be nice to extend .assertArgs() to have, say, a fnType: ... parameter
    // that you could configure to be things like 'normal', 'constructor', or 'templateTag'.
    // In the case of 'templateTag', it can format errors, so instead of saying `<2nd argument>`, it says
    // <1st interpolated value>.
    test('forbids non-special objects (i.e. object types that do not have special interpolation behaviors) to be interpolated', () => {
      const obj = { x: 2 };
      const act = (): any => validator`${obj as any}`;
      assert.throws(act,
        {
          message: [
            (
              'Received invalid "interpolated" arguments for validator`...`: ' +
              'One of the following issues needs to be resolved:'
            ),
            '  * Expected <2nd argument>, which was [object Object], to be a primitive.',
            '  * Expected <2nd argument>, which was [object Object], to be a Validator.',
            '  * Expected <2nd argument>, which was [object Object], to be an Expectation (from .expectTo()).',
            '  * Expected <2nd argument>, which was [object Object], to be a LazyEvaluator (from .lazy()).',
            '  * Expected <2nd argument>, which was [object Object], to be a direct instance of `RegExp`.',
            '  * Expected <2nd argument>, which was [object Object], to be an instance of `Function`.',
          ].join('\n'),
        },
      );
      assert.throws(act, TypeError);
    });

    test('forbids non-special objects to be interpolated in fromRuleset()', () => {
      const obj = { x: 2 };
      const act = (): any => validator.fromRuleset({
        rootRule: { category: 'noop' },
        interpolated: [{ invalid: 'object' } as any],
      });
      assert.throws(act,
        {
          message: [
            (
              'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
              'One of the following issues needs to be resolved:'
            ),
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be a primitive.',
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be a Validator.',
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be an Expectation (from .expectTo()).',
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be a LazyEvaluator (from .lazy()).',
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be a direct instance of `RegExp`.',
            '  * Expected <1st argument>.interpolated[0], which was [object Object], to be an instance of `Function`.',
          ].join('\n'),
        },
      );
      assert.throws(act, TypeError);
    });

    test('can not interpolate an inherited regular expression', () => {
      class MyRegExp extends RegExp {}
      const act = (): any => validator`${new MyRegExp(String.raw`^\d{3}$`, 'g')}`;
      expect(act).toThrow('* Expected <2nd argument>, which was [object MyRegExp], to be a direct instance of `RegExp`.');
    });

    test('can match against a cross-realm regular expression', () => {
      const RealmRegex = vm.runInNewContext(String.raw`/^\d{3}$/g`);
      const v = validator`${RealmRegex}`;
      v.assertMatches('123');
    });

    test('can not interpolate a derived validator', () => {
      const myValidator = validator`{}`;
      const myDerivedValidator = Object.create(myValidator);
      const act = (): any => validator`${myDerivedValidator}`;
      expect(act).toThrow('* Expected <2nd argument>, which was [object Object], to be a Validator.');
    });

    test('can not interpolate a derived lazy evaluator', () => {
      const myLazyEvaluator = validator.lazy(() => validator`{}`);
      const myDerivedLazyEvaluator = Object.create(myLazyEvaluator);
      const act = (): any => validator`${myDerivedLazyEvaluator}`;
      expect(act).toThrow('* Expected <2nd argument>, which was [object Object], to be a LazyEvaluator (from .lazy()).');
    });

    test('can not interpolate a derived expectation', () => {
      const myExpectation = validator.expectTo(() => undefined);
      const myDerivedExpectation = Object.create(myExpectation);
      const act = (): any => validator`${myDerivedExpectation}`;
      expect(act).toThrow('* Expected <2nd argument>, which was [object Object], to be an Expectation (from .expectTo()).');
    });
  });

  describe('custom validation requirements for rulesets', () => {
    test('union rules can not have zero variants', () => {
      const ruleset: Ruleset = {
        rootRule: {
          category: 'union',
          variants: [],
        },
        interpolated: [],
      };

      const act = (): any => validator.fromRuleset(ruleset);

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>.rootRule.variants, which was [object Array], to be non-empty.'
        ),
      });
    });

    test('intersection rules can not have zero variants', () => {
      const ruleset: Ruleset = {
        rootRule: {
          category: 'intersection',
          variants: [],
        },
        interpolated: [],
      };

      const act = (): any => validator.fromRuleset(ruleset);

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>.rootRule.variants, which was [object Array], to be non-empty.'
        ),
      });
    });

    test('tuple rules can not have the wrong number of labels', () => {
      const primitiveRule = { category: 'simple', type: 'string' } as const;
      const ruleset: Ruleset = {
        rootRule: {
          category: 'tuple',
          content: [primitiveRule],
          optionalContent: [primitiveRule, primitiveRule],
          rest: primitiveRule,
          entryLabels: ['A', 'B', 'C'],
        },
        interpolated: [],
      };

      const act = (): any => validator.fromRuleset(ruleset);

      // TODO: This error isn't ideal.
      // It is recommending some rules like noop and array, both of which aren't the real problem
      // in this case. I don't know if there's really a good fix for that issue.
      assert.throws(act, {
        message: [
          (
            'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
            'One of the following issues needs to be resolved:'
          ),
          '  * Expected <1st argument>.rootRule.category to be "noop" but got "tuple".',
          '  * Expected <1st argument>.rootRule.category to be "array" but got "tuple".',
          '  * Expected <1st argument>.rootRule, which was [object Object], to have exactly 4 label(s) but found 3.',
        ].join('\n'),
      });
    });

    const primitiveLiteralTests = [
      { value: NaN, messageFragment: 'which was NaN, to not be NaN.' },
      { value: Infinity, messageFragment: 'which was Infinity, to be finite.' },
      { value: -Infinity, messageFragment: 'which was -Infinity, to be finite.' },
    ];
    for (const { value, messageFragment } of primitiveLiteralTests) {
      test(`primitive literal rules can not be ${value}`, () => {
        const ruleset: Ruleset = {
          rootRule: { category: 'primitiveLiteral', value },
          interpolated: [],
        };

        const act = (): any => validator.fromRuleset(ruleset);

        assert.throws(act, {
          message: [
            (
              'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
              'One of the following issues needs to be resolved:'
            ),
            '  * Expected <1st argument>.rootRule.value to be of type "string" but got type "number".',
            '  * Expected <1st argument>.rootRule.value to be of type "bigint" but got type "number".',
            '  * Expected <1st argument>.rootRule.value to be of type "boolean" but got type "number".',
            `  * Expected <1st argument>.rootRule.value, ${messageFragment}`,
          ].join('\n'),
        });
      });
    }

    function createPropertyRulesetWithContentOf(content: any): Ruleset {
      return {
        rootRule: {
          category: 'property' as const,
          content,
          dynamicContent: new Map(),
          index: null,
        },
        interpolated: [],
      };
    }

    test('property rules can not have derived map instances', () => {
      class MyMap extends Map {}
      const act = (): any => validator.fromRuleset(
        createPropertyRulesetWithContentOf(new MyMap()),
      );

      expect(act).toThrow('<1st argument>.rootRule.content');
      expect(act).toThrow('to be a direct instance of `FrozenMap`');
      expect(act).toThrow('to be a direct instance of `Map`');
    });

    test('property rules can have derived map instances from other realms', () => {
      const RealmMap = vm.runInNewContext('Map');
      assert(RealmMap !== Map);

      validator.fromRuleset(
        createPropertyRulesetWithContentOf(new RealmMap()),
      );
    });

    test('property rules can not have derived FrozenMap instances', () => {
      // No one better be doing anything this convoluted to get at the internal FrozenMap class.
      const frozenMapInstance = (validator`{}`.ruleset.rootRule as PropertyRule).content;
      const FrozenMap = frozenMapInstance.constructor;
      class MyFrozenMap extends (FrozenMap as any) {}

      const act = (): any => -validator.fromRuleset(
        createPropertyRulesetWithContentOf(new MyFrozenMap()),
      );

      expect(act).toThrow('<1st argument>.rootRule.content');
      expect(act).toThrow('to be a direct instance of `FrozenMap`');
      expect(act).toThrow('to be a direct instance of `Map`');
    });

    test('property rules can not have derived map instances from other realms', () => {
      const RealmMap = vm.runInNewContext('Map');
      class MyRealmMap extends RealmMap {}

      const act = (): any => validator.fromRuleset(
        createPropertyRulesetWithContentOf(new MyRealmMap()),
      );

      expect(act).toThrow('<1st argument>.rootRule.content');
      expect(act).toThrow('to be a direct instance of `FrozenMap`');
      expect(act).toThrow('to be a direct instance of `Map`');
    });

    test('interpolation rules can not use out-of-bound indices', () => {
      const act = (): any => validator.fromRuleset({
        rootRule: {
          category: 'interpolation',
          interpolationIndex: 2,
        },
        interpolated: ['x'],
      });

      assert.throws(act, {
        message: (
          'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
          'Expected <1st argument>.rootRule.interpolationIndex, which was 2, to be an in-bounds ' +
          'interpolation index. Received 1 interpolated value(s).'
        ),
      });
    });

    // This behavior is useful with type-transformers, where you might be passing along
    // an interpolated array, without bothering to remove unnecessary stuff from it.
    test('there can be more interpolated values than rules that use them', () => {
      // No error.
      validator.fromRuleset({
        rootRule: { category: 'noop' },
        interpolated: ['x', 'y'],
      });
    });
  });
});
