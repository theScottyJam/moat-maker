import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('intersection rules', () => {
  test('accepts a value that matches all variants of the intersection', () => {
    const v = validator`{ x: number } & { y: number } & { z: number }`;
    v.assertMatches({ x: 2, y: 3, z: 4 });
  });

  test("rejects value that does not match one of the intersection's variants", () => {
    const v = validator`{ x: number } & { y: number } & { z: number }`;
    const act = (): any => v.assertMatches({ x: 2, y: 3 });
    assert.throws(act, { message: '<receivedValue> is missing the required properties: "z"' });
    assert.throws(act, TypeError);
    expect(v.matches({ x: 2, z: 3 })).toBe(false);
    expect(v.matches({ y: 2, z: 3 })).toBe(false);
    expect(v.matches({})).toBe(false);
    expect(v.matches(42)).toBe(false);
  });

  test('produces the correct rule', () => {
    const v = validator`string & null & undefined`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'intersection',
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
      },
      interpolated: [],
    });
    expect(Object.isFrozen(v.ruleset)).toBe(true);
    expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
    expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    expect(Object.isFrozen((v.ruleset.rootRule as any).variants)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator({ raw: [' \tnumber&string \t&\t undefined \t'] });
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'intersection',
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
      },
      interpolated: [],
    });
  });

  test('behaves properly when there is only one intersection in the intersection type', () => {
    const v = validator.fromRuleset({
      rootRule: {
        category: 'intersection',
        variants: [{
          category: 'simple',
          type: 'string',
        }],
      },
      interpolated: [],
    });

    v.assertMatches('xyz');
    expect(v.matches(2)).toBe(false);
  });

  test('Throws a syntax error when there\'s nothing to the right of the "&"', () => {
    const act = (): any => validator`number & `;
    assert.throws(act, {
      message: [
        'Unexpected EOF. (line 1, col 10)',
        '  number &',
        '           ~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
