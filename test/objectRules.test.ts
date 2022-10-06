import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';
import { FrozenMap } from '../src/util';

describe('object rules', () => {
  test('accepts an object with matching fields', () => {
    const v = validator`{ "str!": string, numb?: number }`;
    v.getAsserted({ numb: 2, 'str!': '' });
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

  test('rejects an object missing a required field', () => {
    const v = validator`{ str: string, "numb\"": number, bool: boolean }`;
    const act = (): any => v.getAsserted({ str: '' });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: '<receivedValue> is missing the required fields: "numb\\"", "bool"' });
  });

  test('rejects an object missing both required and optional fields', () => {
    const v = validator`{ str: string, "numb\"": number, bool?: boolean }`;
    const act = (): any => v.getAsserted({ str: '' });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, { message: '<receivedValue> is missing the required fields: "numb\\""' });
  });

  test('accepts a missing optional field', () => {
    const v = validator`{ numb: number, str?: string }`;
    v.getAsserted({ numb: 2 });
  });

  test('rejects when an object field does not match the expected type', () => {
    const v = validator`{ str: string, "numb.\t": number, bool: boolean }`;
    const act = (): any => v.getAsserted({ str: '', 'numb.\t': true, bool: 2 });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: 'Expected <receivedValue>["numb.\\t"] to be of type "number" but got type "boolean".',
    });
  });

  test('rejects when a nested object field does not match the expected type', () => {
    const v = validator`{ sub: { "sub 2": { value: {} } } }`;
    const act = (): any => v.getAsserted({ sub: { 'sub 2': { value: 2 } } });
    assert.throws(act, ValidatorAssertionError);
    assert.throws(act, {
      message: 'Expected <receivedValue>.sub["sub 2"].value to be an object but got 2.',
    });
  });

  describe('index type', () => {
    test('accepts a value who\'s entries all match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      v.getAsserted({ num: 2, str: 'x', another: 1, andAnother: '2' });
    });

    test('rejects when an extra field in the input value does not match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      const act = (): any => v.getAsserted({ num: 2, str: 'x', another: true });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.another to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.another to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
    });

    test('rejects when a required field in the input value does not match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      const act = (): any => v.getAsserted({ num: true, str: 'x' });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.num to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.num to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
    });

    test('rejects when an optional field in the input value does not match the index type', () => {
      const v = validator`{ num: number, str?: string | boolean, [index: string]: string | number }`;
      const act = (): any => v.getAsserted({ num: 2, str: true });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.str to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.str to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
    });

    test('explicit fields are still enforced, even when an index type is also present', () => {
      const v = validator`{ [index: string]: string | number, num: number }`;
      // Object the index type, but not the `num` type.
      const act = (): any => v.getAsserted({ num: 'xyz' });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>.num to be of type "number" but got type "string".' });
    });

    test('index type restrictions only apply to its index key type', () => {
      const v = validator`{ [index: 'another']: number, num: string }`;
      v.getAsserted({ num: 'xyz' });
      v.getAsserted({ num: 'xyz', someOtherProp: 'xyz' });
      expect(v.matches({ another: 'xyz' })).toBe(false);
    });

    test('index type applies to non-enumerable properties', () => {
      const v = validator`{ [index: string]: number }`;
      const inputObj = {};
      Object.defineProperty(inputObj, 'x', {
        value: true,
        enumerable: false,
      });
      const act = (): any => v.getAsserted(inputObj);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>.x to be of type "number" but got type "boolean".' });
    });

    test('index type triggers getters', () => {
      const v = validator`{ [symb: string]: number }`;
      expect(v.matches({ get x() { return 2; } })).toBe(true);
      expect(v.matches({ get x() { return 'x'; } })).toBe(false);
    });

    test('able to use symbols as index type key', () => {
      const v = validator`{ [symb: symbol]: number }`;
      expect(v.matches({ x: 'whatever', [Symbol('1')]: 1, [Symbol('2')]: 2 })).toBe(true);
      expect(v.matches({ x: 'whatever', [Symbol('1')]: 1, [Symbol('2')]: 'oops' })).toBe(false);
    });

    test('able to show named symbols in error messages', () => {
      const v = validator`{ [symb: symbol]: number }`;
      const act = (): any => v.getAsserted({ [Symbol('symName')]: 'oops' });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>[Symbol(symName)] to be of type "number" but got type "string".' });
    });

    test('able to show unnamed symbols in error messages', () => {
      const v = validator`{ [symb: symbol]: number }`;
      // eslint-disable-next-line symbol-description
      const act = (): any => v.getAsserted({ [Symbol()]: 'oops' });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>[Symbol()] to be of type "number" but got type "string".' });
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
    const v = validator`{ "numKey\n": number, strKey?: string }`;
    assert(v.rule.category === 'object');
    expect(v.rule.index).toBe(null);
    expect(v.rule.content).toBeInstanceOf(FrozenMap);
    expect(v.rule.content.size).toBe(2);
    expect(v.rule.content.get('numKey\n')).toMatchObject({
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
    expect(Object.isFrozen(v.rule.content.get('numKey\n'))).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('strKey'))).toBe(true);
  });

  test('produces the correct rule with an indexed type', () => {
    const v = validator`{ alwaysPresentKey: string, [index: "someOtherKey"]: string }`;
    assert(v.rule.category === 'object');
    expect(v.rule.content).toBeInstanceOf(FrozenMap);
    expect(v.rule.content.size).toBe(1);
    expect(v.rule.content.get('alwaysPresentKey')).toMatchObject({
      optional: false,
      rule: {
        category: 'simple',
        type: 'string',
      },
    });
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('alwaysPresentKey'))).toBe(true);
    expect(v.rule.index).toMatchObject({
      key: {
        category: 'primitiveLiteral',
        value: 'someOtherKey',
      },
      value: {
        category: 'simple',
        type: 'string',
      },
    });
    expect(Object.isFrozen(v.rule.index)).toBe(true);
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

  describe('index type syntax errors', () => {
    test("token after index syntax's `[` must be an identifier", () => {
      const act = (): any => validator`{ [2: string]: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected an identifier, followed by ":" and a type. (line 1, col 4)',
          '  { [2: string]: number }',
          '     ~',
        ].join('\n'),
      });
    });

    test('a colon must separate an index name and its type.', () => {
      const act = (): any => validator`{ [index]: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          "Expected a colon here to separate the index key's name on the left, from a type on the right. (line 1, col 9)",
          '  { [index]: number }',
          '          ~',
        ].join('\n'),
      });
    });

    test("a valid type must appear after the index key's colon", () => {
      const act = (): any => validator`{ [index: @]: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected to find a type here. (line 1, col 11)',
          '  { [index: @]: number }',
          '            ~',
        ].join('\n'),
      });
    });

    test('a right bracket must close the index key definition', () => {
      const act = (): any => validator`{ [index: @]: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected to find a type here. (line 1, col 11)',
          '  { [index: @]: number }',
          '            ~',
        ].join('\n'),
      });
    });

    test('a right bracket must close the index key definition', () => {
      const act = (): any => validator`{ [index: string number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a closing right bracket (`]`). (line 1, col 18)',
          '  { [index: string number }',
          '                   ~~~~~~',
        ].join('\n'),
      });
    });

    test('a colon must follow the right bracket', () => {
      const act = (): any => validator`{ [index: string] number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 19)',
          '  { [index: string] number }',
          '                    ~~~~~~',
        ].join('\n'),
      });
    });

    test('can not mix index type syntax with optional field syntax', () => {
      const act = (): any => validator`{ [index: string]?: number }`;
      assert.throws(act, ValidatorSyntaxError);
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 18)',
          '  { [index: string]?: number }',
          '                   ~',
        ].join('\n'),
      });
    });
  });
});
