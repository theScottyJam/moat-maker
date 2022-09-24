import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('tuple rules', () => {
  test('accepts an array with matching entries', () => {
    const v = validator`[string, number]`;
    v.assertMatches(['abc', 2]);
  });

  test('accepts an empty array', () => {
    const v = validator`[]`;
    v.assertMatches([]);
  });

  test('rejects a non-array', () => {
    const v = validator`[string, number]`;
    const act = (): any => v.assertMatches({});
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Object].' });
  });

  test('rejects a typed-array', () => {
    const v = validator`[string, number]`;
    const act = (): any => v.assertMatches(new Uint8Array());
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue> to be an array but got [object Uint8Array].' });
  });

  test('rejects an array of the wrong length', () => {
    const v = validator`[string, number]`;
    const act = (): any => v.assertMatches(['xyz']);
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected the <receivedValue> array to have 2 entries, but found 1.' });
  });

  test('rejects an array with the wrong fields', () => {
    const v = validator`[string, number]`;
    const act = (): any => v.assertMatches(['abc', 'def']);
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "number" but got type "string".' });
  });

  test('accepts an inherited array', () => {
    class MyArray extends Array {}
    const v = validator`[string, number]`;
    v.assertMatches(new (MyArray as any)('abc', 2));
  });

  test('rejects an inherited array with the wrong fields', () => {
    class MyArray extends Array {}
    const v = validator`[string, number]`;
    const act = (): any => v.assertMatches(new (MyArray as any)('abc', 'def'));
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue>[1] to be of type "number" but got type "string".' });
  });

  test('produces the correct rule', () => {
    const v = validator`[string, number]`;
    expect(v.rule).toMatchObject({
      category: 'tuple',
      content: [
        {
          category: 'simple',
          type: 'string',
        },
        {
          category: 'simple',
          type: 'number',
        },
      ],
      optionalContent: [],
      rest: null,
    });
    expect(Object.isFrozen(v.rule)).toBe(true);
  });

  describe('Syntax errors', () => {
    test('forbids an omitted separator', () => {
      const act = (): any => validator`[number string]`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a comma (`,`) or closing bracket (`]`). (line 1, col 9)',
          '  [number string]',
          '          ~~~~~~',
        ].join('\n'),
      });
    });

    test('allows a trailing comma', () => {
      validator`[number, string,]`;
    });

    test('forbids an empty tuple with a lone comma', () => {
      const act = (): any => validator`[,]`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a tuple entry or a closing bracket (`]`). (line 1, col 2)',
          '  [,]',
          '   ~',
        ].join('\n'),
      });
    });
  });
});
