import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError, type SimpleRule, type SimpleTypeVariant } from '../src';

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
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue> to be of type "number" but got type "null".',
        '  * Expected <receivedValue> to be of type "string" but got type "null".',
        '  * Expected <receivedValue> to be of type "undefined" but got type "null".',
      ].join('\n'),
    });
    assert.throws(act, TypeError);
  });

  test('properly indents multiline errors when composing multiple errors together.', () => {
    const expectNothing = validator.expectTo(() => 'throw\na multiline\nerror.');
    const v = validator`number | ${expectNothing}`;
    const act = (): any => v.assertMatches(null);
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue> to be of type "number" but got type "null".',
        '  * Expected <receivedValue>, which was null, to throw',
        '    a multiline',
        '    error.',
      ].join('\n'),
    });
  });

  test('produces the correct rule', () => {
    const v = validator`string | null | undefined`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
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
      },
      interpolated: [],
    });
    expect(Object.isFrozen(v.ruleset)).toBe(true);
    expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
    expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    expect(Object.isFrozen((v.ruleset.rootRule as any).variants)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator({ raw: [' \tnumber|string \t|\t undefined \t'] } as any);
    expect(v.ruleset).toMatchObject({
      rootRule: {
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
      },
      interpolated: [],
    });
  });

  test('behaves properly when there is only one variant in the union type', () => {
    const v = validator.fromRuleset({
      rootRule: {
        category: 'union',
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

  test('Flattens nested union errors', () => {
    const createSimpleRule = (type: SimpleTypeVariant): SimpleRule => ({ category: 'simple' as const, type });
    const v = validator.fromRuleset({
      rootRule: {
        category: 'union',
        variants: [
          createSimpleRule('number'),
          {
            category: 'union',
            variants: [createSimpleRule('string'), createSimpleRule('undefined')],
          },
        ],
      },
      interpolated: [],
    });

    const act = (): any => v.assertMatches(null);
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue> to be of type "number" but got type "null".',
        '  * Expected <receivedValue> to be of type "string" but got type "null".',
        '  * Expected <receivedValue> to be of type "undefined" but got type "null".',
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

  test('removes identical error messages (test 1)', () => {
    const v = validator`[2] | [3]`;
    const act = (): any => v.assertMatches('bad value');
    assert.throws(act, {
      message: 'Expected <receivedValue> to be an array but got "bad value".',
    });
  });

  test('removes identical error messages (test 2)', () => {
    const v = validator`{ x: 2 } | { x: 2 }`;
    const act = (): any => v.assertMatches({ x: 3 });
    assert.throws(act, {
      message: 'Expected <receivedValue>.x to be 2 but got 3.',
    });
  });

  test('union errors are auto-flattened', () => {
    const v = validator`{ x: 2 } | { x: 3 | 4 }`;
    const act = (): any => v.assertMatches({ x: 0 });
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>.x to be 2 but got 0.',
        '  * Expected <receivedValue>.x to be 3 but got 0.',
        '  * Expected <receivedValue>.x to be 4 but got 0.',
      ].join('\n'),
    });
  });
});
