import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('array rules', () => {
  test('accepts an array with matching entries', () => {
    const v = validator`string[]`;
    v.getAsserted(['abc', 'xyz']);
  });

  test('accepts an empty array', () => {
    const v = validator`string[]`;
    v.getAsserted([]);
  });

  test('rejects a non-array', () => {
    const v = validator`string[]`;
    const act = (): any => v.getAsserted({});
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Object].' });
  });

  test('rejects a typed-array', () => {
    const v = validator`string[]`;
    const act = (): any => v.getAsserted(new Uint8Array());
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Uint8Array].' });
  });

  test('rejects an array with the wrong fields', () => {
    const v = validator`string[]`;
    const act = (): any => v.getAsserted(['abc', 2, 'xyz']);
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "string" but got type "number".' });
  });

  test('accepts an inherited array', () => {
    class MyArray extends Array {}
    const v = validator`string[]`;
    v.getAsserted(new (MyArray as any)('abc', 'xyz'));
    expect(v.matches(new (MyArray as any)('abc', 2))).toBe(false);
  });

  test('rejects an inherited array with the wrong fields', () => {
    class MyArray extends Array {}
    const v = validator`string[]`;
    const act = (): any => v.getAsserted(new (MyArray as any)('xyz', 3));
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "string" but got type "number".' });
  });

  describe('multi-dimensional array patterns', () => {
    test('accepts a multi-dimensional array', () => {
      const v = validator`string[][]`;
      v.getAsserted([['abc'], ['xyz']]);
      v.getAsserted([]);
    });

    test('rejects an array that has too few dimensions', () => {
      const v = validator`string[][]`;
      const act = (): any => v.getAsserted(['xyz']);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>[0] to be an array but got "xyz".' });
    });

    test('rejects entries of the wrong type', () => {
      const v = validator`string[][]`;
      const act = (): any => v.getAsserted([[], ['x', 'y', 2]]);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>[1][2] to be of type "string" but got type "number".' });
    });
  });

  test('produces the correct rule', () => {
    const v = validator`string[]`;
    expect(v.rule).toMatchObject({
      category: 'array',
      content: {
        category: 'simple',
        type: 'string',
      },
    });
    expect(Object.isFrozen(v.rule)).toBe(true);
  });

  test('Gives the right error when the right `]` is missing', () => {
    const act = (): any => validator`string[ | number`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Expected a `]` to close the opening `[`. (line 1, col 9)',
        '  string[ | number',
        '          ~',
      ].join('\n'),
    });
  });
});
