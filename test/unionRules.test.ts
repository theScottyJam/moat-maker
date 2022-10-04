import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('union rules', () => {
  test('accepts all variants of a union', () => {
    const v = validator`number | string | undefined`;
    v.getAsserted('xyz');
    v.getAsserted(2);
    v.getAsserted(undefined);
  });

  test("rejects value that does not match any of the union's variants", () => {
    const v = validator`number | string | undefined`;
    const act = (): any => v.getAsserted(null);
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: [
        "Received value did not match any of the union's variants.",
        '  Variant 1: Expected <receivedValue> to be of type "number" but got type "null".',
        '  Variant 2: Expected <receivedValue> to be of type "string" but got type "null".',
        '  Variant 3: Expected <receivedValue> to be of type "undefined" but got type "null".',
      ].join('\n'),
    });
  });

  test('produces the correct rule', () => {
    const v = validator`string | null`;
    expect(v.rule).toMatchObject({
      category: 'union',
      variants: [
        {
          category: 'simple',
          type: 'string',
        }, {
          category: 'simple',
          type: 'null',
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

    v.getAsserted('xyz');
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

    const act = (): any => v.getAsserted(null);
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: [
        "Received value did not match any of the union's variants.",
        '  Variant 1: Expected <receivedValue> to be of type "number" but got type "null".',
        '  Variant 2: Expected <receivedValue> to be of type "string" but got type "null".',
        '  Variant 3: Expected <receivedValue> to be of type "undefined" but got type "null".',
      ].join('\n'),
    });
  });

  test('Throws a syntax error when there\'s nothing to the right of the "|"', () => {
    const act = (): any => validator`number | `;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Unexpected EOF. (line 1, col 10)',
        '  number | ',
        '           ~',
      ].join('\n'),
    });
  });
});
