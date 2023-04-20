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
        'Expected <argumentList>[0] to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertMatches()', () => {
    const act = (): any => (validator`string`.assertMatches as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
        'Expected <argumentList>[1] to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertionTypeGuard()', () => {
    const act = (): any => (validator`string`.assertionTypeGuard as any)('someValue', 42);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertionTypeGuard(): ' +
        'Expected <argumentList>[1] to be an object but got 42.'
      ),
    });
  });

  test('<validator instance>.assertArgs() (test 1)', () => {
    const act = (): any => validator`string`.assertArgs('myFn', { length: 2.5 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <argumentList>[1], which was [object Object], to be array-like.'
      ),
    });
  });

  test('<validator instance>.assertArgs() (test 2)', () => {
    const act = (): any => validator`string`.assertArgs('myFn', { length: -2 });
    assert.throws(act, {
      message: (
        'Received invalid "args" argument for <validator instance>.assertArgs(): ' +
        'Expected <argumentList>[1], which was [object Object], to be array-like.'
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

    // TODO: Oh wow. This is an awful error. Lets figure out something we can do about this.
    assert.throws(act, {
      message: [
        'Received invalid "ruleset" argument for validator.fromRuleset(): Failed to match against any variant of a union.',
        '  Variant 1: <argumentList>[0].rootRule is missing the required properties: "type"',
        '  Variant 2: <argumentList>[0].rootRule is missing the required properties: "value"',
        '  Variant 3: Expected <argumentList>[0].rootRule.category to be "noop" but got "union".',
        '  Variant 4: <argumentList>[0].rootRule is missing the required properties: "content", "dynamicContent", "index"',
        '  Variant 5: <argumentList>[0].rootRule is missing the required properties: "content"',
        '  Variant 6: <argumentList>[0].rootRule is missing the required properties: "content", "optionalContent", "rest", "entryLabels"',
        '  Variant 7: <argumentList>[0].rootRule is missing the required properties: "iterableType", "entryType"',
        '  Variant 8: Failed to match against any variant of a union.',
        '      Variant 1: <argumentList>[0].rootRule.variants[0] is missing the required properties: "type"',
        '      Variant 2: <argumentList>[0].rootRule.variants[0] is missing the required properties: "value"',
        '      Variant 3: Expected <argumentList>[0].rootRule.variants[0].category to be "noop" but got "array".',
        '      Variant 4: <argumentList>[0].rootRule.variants[0] is missing the required properties: "dynamicContent", "index"',
        '      Variant 5: Failed to match against any variant of a union.',
        '          Variant 1: <argumentList>[0].rootRule.variants[0].content is missing the required properties: "type"',
        '          Variant 2: <argumentList>[0].rootRule.variants[0].content is missing the required properties: "value"',
        '          Variant 3: Expected <argumentList>[0].rootRule.variants[0].content.category to be "noop" but got "intersection".',
        '          Variant 4: <argumentList>[0].rootRule.variants[0].content is missing the required properties: ' +
          '"content", "dynamicContent", "index"',
        '          Variant 5: <argumentList>[0].rootRule.variants[0].content is missing the required properties: "content"',
        '          Variant 6: <argumentList>[0].rootRule.variants[0].content is missing the required properties: ' +
          '"content", "optionalContent", "rest", "entryLabels"',
        '          Variant 7: <argumentList>[0].rootRule.variants[0].content is missing the required properties: "iterableType", "entryType"',
        '          Variant 8: Expected <argumentList>[0].rootRule.variants[0].content.category to be "union" but got "intersection".',
        '          Variant 9: Failed to match against any variant of a union.',
        '              Variant 1: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: "type"',
        '              Variant 2: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: "value"',
        '              Variant 3: Expected <argumentList>[0].rootRule.variants[0].content.variants[1].category to be ' +
          '"noop" but got "nonsenseCategory".',
        '              Variant 4: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: ' +
          '"content", "dynamicContent", "index"',
        '              Variant 5: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: "content"',
        '              Variant 6: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: ' +
          '"content", "optionalContent", "rest", "entryLabels"',
        '              Variant 7: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: ' +
          '"iterableType", "entryType"',
        '              Variant 8: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: "variants"',
        '              Variant 9: <argumentList>[0].rootRule.variants[0].content.variants[1] is missing the required properties: ' +
          '"interpolationIndex"',
        '          Variant 10: <argumentList>[0].rootRule.variants[0].content is missing the required properties: "interpolationIndex"',
        '      Variant 6: <argumentList>[0].rootRule.variants[0] is missing the required properties: "optionalContent", "rest", "entryLabels"',
        '      Variant 7: <argumentList>[0].rootRule.variants[0] is missing the required properties: "iterableType", "entryType"',
        '      Variant 8: <argumentList>[0].rootRule.variants[0] is missing the required properties: "variants"',
        '      Variant 9: <argumentList>[0].rootRule.variants[0] is missing the required properties: "interpolationIndex"',
        '  Variant 9: Expected <argumentList>[0].rootRule.category to be "intersection" but got "union".',
        '  Variant 10: <argumentList>[0].rootRule is missing the required properties: "interpolationIndex"',
      ].join('\n'),
    });
  });

  test('validator.from()', () => {
    const act = (): any => validator.from(42 as any);
    assert.throws(act, {
      message: [
        'Received invalid "stringOrValidator" argument for validator.from(): Failed to match against any variant of a union.',
        '  Variant 1: Expected <argumentList>[0] to be of type "string" but got type "number".',
        '  Variant 2: Expected <argumentList>[0], which was 42, to be a validator instance.',
      ].join('\n'),
    });
  });

  test('A validator returned from validator.from() input checking on its methods', () => {
    const v = validator.from('string');
    const act = (): any => v.assertMatches('bad', 'arguments' as any);
    assert.throws(act, {
      message: (
        'Received invalid "opts" argument for <validator instance>.assertMatches(): ' +
        'Expected <argumentList>[1] to be an object but got "arguments".'
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
        'Expected <argumentList>[0], which was 42, to be a validator instance.'
      ),
    });
  });

  test('validator.expectTo()', () => {
    const act = (): any => validator.expectTo(42 as any);
    assert.throws(act, {
      message: (
        'Received invalid "testExpectation" argument for validator.expectTo(): ' +
        'Expected <argumentList>[0], which was 42, to be an instance of `Function` (and not an instance of a subclass).'
      ),
    });
  });

  test('validator.expectTo() with bad doCheck callback', () => {
    const badChecker = validator.expectTo(() => 2 as any);
    const act = (): any => validator`${badChecker}`.matches(2);
    assert.throws(act, {
      message: [
        (
          'validator.expectTo() received a bad "testExpectation" function: ' +
          'Failed to match against any variant of a union.'
        ),
        '  Variant 1: Expected <testExpectation return value> to be of type "string" but got type "number".',
        '  Variant 2: Expected <testExpectation return value> to be of type "null" but got type "number".',
      ].join('\n'),
    });
  });

  // TODO: Fix existing tests and add more tests, once the large union error problem is fixed
  // (so the error messages aren't super long).
  xdescribe('custom validation requirements for rulesets', () => {
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
        message: '<Something really long>',
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
        message: '<Something really long>',
      });
    });
  });
});
