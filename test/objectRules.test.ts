import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';
import { FrozenMap } from '../src/util';

describe('object rules', () => {
  test('accepts an object with matching fields', () => {
    const v = validator`{ str: string, numb?: number }`;
    v.getAsserted({ numb: 2, str: '' });
  });

  test('accepts an object with extra fields', () => {
    const v = validator`{ str: string }`;
    v.getAsserted({ str: '', numb: 2 });
  });

  test('accepts inherited fields', () => {
    const v = validator`{ toString: ${Function} }`;
    v.getAsserted({});
  });

  test('rejects a primitive', () => {
    const v = validator`{ str: string }`;
    const act = (): any => v.getAsserted('xyz');
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: 'Expected <receivedValue> to be an object but got "xyz".' });
  });

  // TODO: Check that this error works when using string keys with odd characters
  test('rejects an object missing a required field', () => {
    const v = validator`{ str: string, numb: number, bool: boolean }`;
    const act = (): any => v.getAsserted({ str: '' });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: '<receivedValue> is missing the required fields: "numb", "bool"' });
  });

  // TODO: Check that this error works when using string keys with odd characters
  test('rejects an object missing both required and optional fields', () => {
    const v = validator`{ str: string, numb: number, bool?: boolean }`;
    const act = (): any => v.getAsserted({ str: '' });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: '<receivedValue> is missing the required fields: "numb"' });
  });

  test('accepts a missing optional field', () => {
    const v = validator`{ numb: number, str?: string }`;
    v.getAsserted({ numb: 2 });
  });

  // TODO: Check that this error works when using string keys with odd characters
  test('rejects when an object field does not match the expected type', () => {
    const v = validator`{ str: string, numb: number, bool: boolean }`;
    const act = (): any => v.getAsserted({ str: '', numb: true, bool: 2 });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: 'Expected <receivedValue>.numb to be of type "number" but got type "boolean".',
    });
  });

  test('rejects when a nested object field does not match the expected type', () => {
    const v = validator`{ sub: { sub2: { value: {} } } }`;
    const act = (): any => v.getAsserted({ sub: { sub2: { value: 2 } } });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: 'Expected <receivedValue>.sub.sub2.value to be an object but got 2.',
    });
  });

  describe('object type checks', () => {
    test('accepts an array', () => {
      validator`{}`.getAsserted([2]);
    });

    test('accepts a function', () => {
      validator`{}`.getAsserted(() => {});
    });

    test('accepts a boxed primitive', () => {
      validator`{}`.getAsserted(new Number(2)); // eslint-disable-line no-new-wrappers
    });

    test('rejects a symbol', () => {
      const act = (): any => validator`{}`.getAsserted(Symbol('mySymb'));
      assert.throws(act, { message: 'Expected <receivedValue> to be an object but got Symbol(mySymb).' });
    });
  });

  test('produces the correct rule', () => {
    const v = validator`{ numKey: number, strKey?: string }`;
    assert(v.rule.category === 'object');
    expect(v.rule.index).toBe(null);
    expect(v.rule.content).toBeInstanceOf(FrozenMap);
    expect(v.rule.content.size).toBe(2);
    expect(v.rule.content.get('numKey')).toMatchObject({
      optional: false,
      rule: {
        category: 'simple',
        type: 'number',
      },
    });
    expect(v.rule.content.get('strKey')).toMatchObject({
      optional: true,
      rule: {
        category: 'simple',
        type: 'string',
      },
    });
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('numKey'))).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('strKey'))).toBe(true);
  });

  describe('Syntax errors', () => {
    test('throws on invalid object key', () => {
      const act = (): any => validator`{ ||`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { ||',
          '    ~',
        ].join('\n'),
      });
    });

    test('allows "$" and "_" in keys', () => {
      const v = validator`{ $_: string }`;
      v.getAsserted({ $_: 'xyz' });
    });

    test('allows numeric keys', () => {
      const v = validator`{ 42: string }`;
      v.getAsserted({ 42: 'xyz' });
    });

    test('throws on number keys with special characters', () => {
      const act = (): any => validator`{ 2.3: string }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { 2.3: string }',
          '    ~~~',
        ].join('\n'),
      });
    });

    test('throws on missing colon', () => {
      const act = (): any => validator`{ myKey ||`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 9)',
          '  { myKey ||',
          '          ~',
        ].join('\n'),
      });
    });

    test('allows a semicolon as a separator', () => {
      validator`{ key1: number; key2: number }`;
    });

    test('allows a newline as a separator', () => {
      validator`{
        key1: number
        key2: number
      }`;
    });

    test('allows a newline inside a block comment as a separator', () => {
      validator`{
        key1: number /*
        */ key2: number
      }`;
    });

    test('allows a newline at the end of a single-line comment as a separator', () => {
      validator`{
        key1: number // XX
        key2: number
      }`;
    });

    test('forbids an omitted separator', () => {
      const act = (): any => validator`{ key1: number key2: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a comma (`,`) or closing bracket (`}`). (line 1, col 16)',
          '  { key1: number key2: number }',
          '                 ~~~~',
        ].join('\n'),
      });
    });

    test('allows a trailing comma', () => {
      validator`{ key1: number, }`;
    });

    test('allows a trailing semicolon', () => {
      validator`{ key1: number; }`;
    });

    test('forbids an empty object with a separator character', () => {
      const act = (): any => validator`{ , }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { , }',
          '    ~',
        ].join('\n'),
      });
    });
  });
});
