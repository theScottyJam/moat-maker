import { strict as assert } from 'node:assert';
import { ValidatableProtocolFnOpts, validator, ValidatorSyntaxError } from '../src';

describe('union rules', () => {
  test('accepts all variants of a union', () => {
    const v = validator`number | string | undefined`;
    v.assertMatches('xyz');
    v.assertMatches(2);
    v.assertMatches(undefined);
  });

  test("rejects value that does not match any of the union's variants", () => {
    const v = validator`number | string | undefined`;
    const act = (): any => v.assertMatches(null);
    assert.throws(act, {
      message: [
        'Failed to match against every variant of a union.',
        '  Variant 1: Expected <receivedValue> to be of type "number" but got type "null".',
        '  Variant 2: Expected <receivedValue> to be of type "string" but got type "null".',
        '  Variant 3: Expected <receivedValue> to be of type "undefined" but got type "null".',
      ].join('\n'),
    });
    assert.throws(act, TypeError);
  });

  test('properly indents multiline errors when composing multiple errors together.', () => {
    const alwaysFail = {
      [validator.validatable](value: unknown, { failure }: ValidatableProtocolFnOpts) {
        throw failure('a\nmultiline\nerror.');
      },
    };
    const v = validator`number | ${alwaysFail}`;
    const act = (): any => v.assertMatches(null);
    assert.throws(act, {
      message: [
        'Failed to match against every variant of a union.',
        '  Variant 1: Expected <receivedValue> to be of type "number" but got type "null".',
        '  Variant 2: a',
        '    multiline',
        '    error.',
      ].join('\n'),
    });
  });

  test('produces the correct rule', () => {
    const v = validator`string | null | undefined`;
    expect(v.rule).toMatchObject({
      category: 'union',
      variants: [
        {
          category: 'simple',
          type: 'string',
        }, {
          category: 'simple',
          type: 'null',
        }, {
          category: 'simple',
          type: 'undefined',
        },
      ],
    });
    assert(v.rule.category === 'union');
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.variants)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator({ raw: [' \tnumber|string \t|\t undefined \t'] });
    expect(v.rule).toMatchObject({
      category: 'union',
      variants: [
        {
          category: 'simple',
          type: 'number',
        }, {
          category: 'simple',
          type: 'string',
        }, {
          category: 'simple',
          type: 'undefined',
        },
      ],
    });
  });

  test('behaves properly when there is only one variant in the union type', () => {
    const v = validator.fromRule({
      category: 'union',
      variants: [{
        category: 'simple',
        type: 'string',
      }],
    });

    v.assertMatches('xyz');
    expect(v.matches(2)).toBe(false);
  });

  test('Flattens nested union errors', () => {
    const v = validator.fromRule({
      category: 'union',
      variants: [
        {
          category: 'simple',
          type: 'number',
        },
        {
          category: 'union',
          variants: [
            {
              category: 'simple',
              type: 'string',
            }, {
              category: 'simple',
              type: 'undefined',
            },
          ],
        },
      ],
    });

    const act = (): any => v.assertMatches(null);
    assert.throws(act, {
      message: [
        'Failed to match against every variant of a union.',
        '  Variant 1: Expected <receivedValue> to be of type "number" but got type "null".',
        '  Variant 2: Expected <receivedValue> to be of type "string" but got type "null".',
        '  Variant 3: Expected <receivedValue> to be of type "undefined" but got type "null".',
      ].join('\n'),
    });
    assert.throws(act, TypeError);
  });

  test('Throws a syntax error when there\'s nothing to the right of the "|"', () => {
    const act = (): any => validator`number | `;
    assert.throws(act, {
      message: [
        'Unexpected EOF. (line 1, col 10)',
        '  number |',
        '           ~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
