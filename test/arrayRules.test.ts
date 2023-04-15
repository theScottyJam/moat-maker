import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('array rules', () => {
  test('accepts an array with matching entries', () => {
    const v = validator`string[]`;
    v.assertMatches(['abc', 'xyz']);
  });

  test('accepts an empty array', () => {
    const v = validator`string[]`;
    v.assertMatches([]);
  });

  test('rejects a non-array', () => {
    const v = validator`string[]`;
    const act = (): any => v.assertMatches({});
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Object].' });
    assert.throws(act, TypeError);
  });

  test('rejects a typed-array', () => {
    const v = validator`string[]`;
    const act = (): any => v.assertMatches(new Uint8Array());
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Uint8Array].' });
    assert.throws(act, TypeError);
  });

  test('rejects an array with the wrong properties', () => {
    const v = validator`string[]`;
    const act = (): any => v.assertMatches(['abc', 2, 'xyz']);
    assert.throws(act, TypeError);
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "string" but got type "number".' });
  });

  test('accepts an inherited array', () => {
    class MyArray extends Array {}
    const v = validator`string[]`;
    v.assertMatches(new (MyArray as any)('abc', 'xyz'));
    expect(v.matches(new (MyArray as any)('abc', 2))).toBe(false);
  });

  test('rejects an inherited array with the wrong properties', () => {
    class MyArray extends Array {}
    const v = validator`string[]`;
    const act = (): any => v.assertMatches(new (MyArray as any)('xyz', 3));
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "string" but got type "number".' });
    assert.throws(act, TypeError);
  });

  test('rejects sparse arrays if the matcher does not allow for undefined entries', () => {
    const v = validator`number[]`;
    const act = (): any => v.assertMatches([2,, 3]); // eslint-disable-line no-sparse-arrays
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "number" but got type "undefined".' });
    assert.throws(act, TypeError);
  });

  test('allows sparse arrays if the matcher allows undefined entries', () => {
    const v = validator`(number | undefined)[]`;
    v.assertMatches([2,, 3, undefined]); // eslint-disable-line no-sparse-arrays
  });

  describe('multi-dimensional array patterns', () => {
    test('accepts a multi-dimensional array', () => {
      const v = validator`string[][]`;
      v.assertMatches([['abc'], ['xyz']]);
      v.assertMatches([]);
    });

    test('rejects an array that has too few dimensions', () => {
      const v = validator`string[][]`;
      const act = (): any => v.assertMatches(['xyz']);
      assert.throws(act, { message: 'Expected <receivedValue>[0] to be an array but got "xyz".' });
      assert.throws(act, TypeError);
    });

    test('rejects entries of the wrong type', () => {
      const v = validator`string[][]`;
      const act = (): any => v.assertMatches([[], ['x', 'y', 2]]);
      assert.throws(act, { message: 'Expected <receivedValue>[1][2] to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });
  });

  test('produces the correct rule', () => {
    const v = validator`string[]`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'array',
        content: {
          category: 'simple',
          type: 'string',
        },
      },
      interpolated: [],
    });
    expect(Object.isFrozen(v.ruleset)).toBe(true);
    expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
    expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator`string [ ]`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'array',
        content: {
          category: 'simple',
          type: 'string',
        },
      },
      interpolated: [],
    });
  });

  test('Gives the right error when the right `]` is missing', () => {
    const act = (): any => validator`string[ | number`;
    assert.throws(act, {
      message: [
        'Expected a `]` to close the opening `[`. (line 1, col 9)',
        '  string[ | number',
        '          ~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
