import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError } from '../src';

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
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: [
        "Recieved value did not match any of the union's variants.",
        '  Variant 1: Expected a value of type "number" but got type "null".',
        '  Variant 2: Expected a value of type "string" but got type "null".',
        '  Variant 3: Expected a value of type "undefined" but got type "null".',
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
  });

  test('works with funky whitespace', () => {
    const v = validator` \tnumber|string \t|\t undefined \t`;
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

  test('provides concise errors when nested in longer error messages', () => {
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
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: [
        "Recieved value did not match any of the union's variants.",
        '  Variant 1: Expected a value of type "number" but got type "null".',
        "  Variant 2: Recieved value did not match any of the union's variants.", // <-- the concise error
      ].join('\n'),
    });
  });
});
