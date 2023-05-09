/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { strict as assert } from 'node:assert';
import { type Ruleset, validator } from '../src';
import { DISABLE_PARAM_VALIDATION } from '../src/config';

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
        'Received invalid "parts" argument for validator(): ' +
        'Expected <argument #1> to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertMatches()', () => {
    const act = (): any => (validator`string`.assertMatches as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
        'Expected <argument #2> to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertionTypeGuard()', () => {
    const act = (): any => (validator`string`.assertionTypeGuard as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertionTypeGuard(): ' +
        'Expected <argument #2> to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertArgs() (test 1)', () => {
    const act = (): any => validator`string`.assertArgs('myFn', { length: 2.5 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <argument #2>, which was [object Object], to be array-like.'
      ),
    });
  });

  test('<validator instance>.assertArgs() (test 2)', () => {
    const act = (): any => validator`string`.assertArgs('myFn', { length: -2 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <argument #2>, which was [object Object], to be array-like.'
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
        'Expected <argument #1>.rootRule.variants[0].content.variants[1].category to be "noop" but got "nonsenseCategory".'
      ),
    });
  });

  test('validator.from()', () => {
    const act = (): any => validator.from(42 as any);
    assert.throws(act, {
      message: [
        'Received invalid "stringOrValidator" argument for validator.from(): Failed to match against any variant of a union.',
        '  * Expected <argument #1> to be of type "string" but got type "number".',
        '  * Expected <argument #1>, which was 42, to be a validator instance.',
      ].join('\n'),
    });
  });

  test('A validator returned from validator.from() input checking on its methods', () => {
    const v = validator.from('string');
    const act = (): any => v.assertMatches('bad', 'arguments' as any);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
        'Expected <argument #2> to be an object but got "arguments".'
      ),
    });
  });

  test('validator.createRef()', () => {
    const act = (): any => (validator.createRef as any)(42);
    assert.throws(act, {
      message: (
        'Received invalid arguments for validator.createRef(): ' +
        'Expected the <argumentList> array to have 0 entries, but found 1.'
      ),
    });
  });

  test('validator.createRef().set()', () => {
    const act = (): any => validator.createRef().set(42 as any);
    assert.throws(act, {
      message: (
        'Received invalid "validator" argument for <validator ref>.set(): ' +
        'Expected <argument #1>, which was 42, to be a validator instance.'
      ),
    });
  });

  test('validator.expectTo()', () => {
    const act = (): any => validator.expectTo(42 as any);
    assert.throws(act, {
      message: (
        'Received invalid "testExpectation" argument for validator.expectTo(): ' +
        'Expected <argument #1>, which was 42, to be an instance of `Function` (and not an instance of a subclass).'
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
          'Failed to match against any variant of a union.'
        ),
        '  * Expected <testExpectation return value> to be of type "string" but got type "number".',
        '  * Expected <testExpectation return value> to be of type "null" but got type "number".',
      ].join('\n'),
    });
  });

  // TODO: Add more tests here, now that the super-long-union-error bug is fixed
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
          'Expected <argument #1>.rootRule.variants, which was [object Array], to be non-empty.'
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
          'Expected <argument #1>.rootRule.variants, which was [object Array], to be non-empty.'
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
      // The fact that it is recommending some rules like noop and array, both of which aren't the real problem
      // in this case. I don't know if there's really a good fix for that issue.
      assert.throws(act, {
        message: [
          (
            'Received invalid "ruleset" argument for validator.fromRuleset(): ' +
            'Failed to match against any variant of a union.'
          ),
          '  * Expected <argument #1>.rootRule.category to be "noop" but got "tuple".',
          '  * Expected <argument #1>.rootRule.category to be "array" but got "tuple".',
          '  * Expected <argument #1>.rootRule, which was [object Object], to have exactly 4 label(s) but found 3.',
        ].join('\n'),
      });
    });
  });
});
