import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('iterable rules', () => {
  test('accepts iterables with correct entry types an input', () => {
    const v = validator`${Array}@<number>`;
    v.assertMatches([2, 3, 4]);
  });

  test('accepts an empty iterable', () => {
    const v = validator`${Array}@<number>`;
    v.assertMatches([]);
  });

  test('rejects when input iterable is of the incorrect type', () => {
    const v = validator`${Array}@<number>`;
    const act = (): any => v.assertMatches('abc');
    assert.throws(act, {
      message: 'Expected <receivedValue>, which was "abc", to be an instance of `Array` (and not an instance of a subclass).',
    });
    assert.throws(act, TypeError);
  });

  test('rejects when iterable entry is of the incorrect type', () => {
    const v = validator`${Array}@<number>`;
    const act = (): any => v.assertMatches([2, 'xyz']);
    assert.throws(act, { message: 'Expected [...<receivedValue>][1] to be of type "number" but got type "string".' });
    assert.throws(act, TypeError);
  });

  test('rejects non-iterable inputs', () => {
    const v = validator`unknown@<string>`;
    const act = (): any => v.assertMatches(42);
    assert.throws(act, { message: 'Expected <receivedValue> to be an iterable, i.e. you should be able to use this value in a for-of loop.' });
    assert.throws(act, TypeError);
  });

  test('Using a non-iterable as the iterable type causes all inputs to be rejected', () => {
    // number is not an iterable, but we put it before the @<...> anyways.
    const v = validator`number@<number>`;
    // Now you shouldn't be able to pass any valid inputs into it.
    const act = (): any => v.assertMatches(42);
    assert.throws(act, { message: 'Expected <receivedValue> to be an iterable, i.e. you should be able to use this value in a for-of loop.' });
    assert.throws(act, TypeError);
  });

  test('produces the correct rule', () => {
    const v = validator`unknown@<string>`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'iterable',
        iterableType: {
          category: 'noop',
        },
        entryType: {
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
    const v = validator`unknown @ < string >`;
    expect(v.ruleset).toMatchObject({
      rootRule: {
        category: 'iterable',
        iterableType: {
          category: 'noop',
        },
        entryType: {
          category: 'simple',
          type: 'string',
        },
      },
      interpolated: [],
    });
  });

  describe('syntax errors', () => {
    test('forbids a `@` without a `<`', () => {
      const act = (): any => validator`unknown@string`;
      assert.throws(act, {
        message: [
          'Expected an opening angled bracket (`<`). (line 1, col 9)',
          '  unknown@string',
          '          ~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('forbids content where a `>` is expected', () => {
      const act = (): any => validator`unknown@<string number>`;
      assert.throws(act, {
        message: [
          'Expected a closing angled bracket (`>`). (line 1, col 17)',
          '  unknown@<string number>',
          '                  ~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('forbids EOF where a `>` is expected', () => {
      const act = (): any => validator`unknown@<string`;
      assert.throws(act, {
        message: [
          'Expected a closing angled bracket (`>`). (line 1, col 16)',
          '  unknown@<string',
          '                 ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });
  });

  describe('example iterable types', () => {
    test('array', () => {
      const v = validator`${Array}@<number>`;
      expect(v.matches([2, 3])).toBe(true);
      expect(v.matches([2, 'x'])).toBe(false);
      expect(v.matches(new Set([2, 3]))).toBe(false);
    });

    test('set', () => {
      const v = validator`${Set}@<number>`;
      expect(v.matches(new Set([2, 3]))).toBe(true);
      expect(v.matches(new Set([2, 'x']))).toBe(false);
      expect(v.matches([2, 3])).toBe(false);
    });

    test('map', () => {
      const v = validator`${Map}@<[number, string]>`;
      expect(v.matches(new Map([[2, 'x'], [3, 'y']]))).toBe(true);
      expect(v.matches(new Map<any, any>([[2, 'x'], ['a', 'y']]))).toBe(false);
      expect(v.matches(new Map<any, any>([[2, 'x'], [3, 4]]))).toBe(false);
    });

    test('string', () => {
      const v = validator`string@<string>`;
      expect(v.matches('xyz')).toBe(true);
      expect(v.matches('')).toBe(true);
      expect(v.matches([])).toBe(false);
      expect(validator`string@<number>`.matches('123')).toBe(false);
    });

    test('unknown', () => {
      const v = validator`unknown@<number>`;
      expect(v.matches([2, 3])).toBe(true);
      expect(v.matches([2, 'x'])).toBe(false);
      expect(v.matches(new Set([2, 3]))).toBe(true);
      expect(v.matches(new Set([2, 'x']))).toBe(false);
    });

    test('generator', () => {
      const v = validator`unknown@<string>`;
      function * g1(): Generator<string> { yield 'x'; yield 'y'; }
      expect(v.matches(g1())).toBe(true);
      function * g2(): Generator<any> { yield 'x'; yield 2; }
      expect(v.matches(g2())).toBe(false);
    });
  });
});
