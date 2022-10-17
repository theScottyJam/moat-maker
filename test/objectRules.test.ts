import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';
import { FrozenMap } from '../src/util';

describe('object rules', () => {
  test('accepts an object with matching properties', () => {
    const v = validator`{ "str!": string, numb?: number }`;
    v.assertMatches({ numb: 2, 'str!': '' });
  });

  test('accepts an object with extra properties', () => {
    const v = validator`{ str: string }`;
    v.assertMatches({ str: '', numb: 2 });
  });

  test('accepts inherited properties', () => {
    const v = validator`{ toString: ${Function} }`;
    v.assertMatches({});
  });

  test('rejects a primitive', () => {
    const v = validator`{ str: string }`;
    const act = (): any => v.assertMatches('xyz');
    assert.throws(act, { message: 'Expected <receivedValue> to be an object but got "xyz".' });
    assert.throws(act, ValidatorAssertionError);
  });

  test('rejects an object missing a required property', () => {
    const v = validator`{ str: string, "numb\"": number, bool: boolean }`;
    const act = (): any => v.assertMatches({ str: '' });
    assert.throws(act, { message: '<receivedValue> is missing the required properties: "numb\\"", "bool"' });
    assert.throws(act, ValidatorAssertionError);
  });

  test('rejects an object missing both required and optional properties', () => {
    const v = validator`{ str: string, "numb\"": number, bool?: boolean }`;
    const act = (): any => v.assertMatches({ str: '' });
    assert.throws(act, { message: '<receivedValue> is missing the required properties: "numb\\""' });
    assert.throws(act, ValidatorAssertionError);
  });

  test('accepts a missing optional property', () => {
    const v = validator`{ numb: number, str?: string }`;
    v.assertMatches({ numb: 2 });
  });

  test('rejects when an object property does not match the expected type', () => {
    const v = validator`{ str: string, "numb.\t": number, bool: boolean }`;
    const act = (): any => v.assertMatches({ str: '', 'numb.\t': true, bool: 2 });
    assert.throws(act, {
      message: 'Expected <receivedValue>["numb.\\t"] to be of type "number" but got type "boolean".',
    });
    assert.throws(act, ValidatorAssertionError);
  });

  test('rejects when a nested object property does not match the expected type', () => {
    const v = validator`{ sub: { "sub 2": { value: {} } } }`;
    const act = (): any => v.assertMatches({ sub: { 'sub 2': { value: 2 } } });
    assert.throws(act, {
      message: 'Expected <receivedValue>.sub["sub 2"].value to be an object but got 2.',
    });
    assert.throws(act, ValidatorAssertionError);
  });

  describe('object type checks', () => {
    test('accepts an array', () => {
      validator`{}`.assertMatches([2]);
    });

    test('accepts a function', () => {
      validator`{}`.assertMatches(() => {});
    });

    test('accepts a boxed primitive', () => {
      validator`{}`.assertMatches(new Number(2)); // eslint-disable-line no-new-wrappers
    });

    test('rejects a symbol', () => {
      const act = (): any => validator`{}`.assertMatches(Symbol('mySymb'));
      assert.throws(act, { message: 'Expected <receivedValue> to be an object but got Symbol(mySymb).' });
    });
  });

  describe('index type', () => {
    test('accepts a value who\'s entries all match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      v.assertMatches({ num: 2, str: 'x', another: 1, andAnother: '2' });
    });

    test('rejects when an extra property in the input value does not match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      const act = (): any => v.assertMatches({ num: 2, str: 'x', another: true });
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.another to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.another to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
      assert.throws(act, ValidatorAssertionError);
    });

    test('rejects when a required property in the input value does not match the index type', () => {
      const v = validator`{ num: number | boolean, str?: string, str2?: string, [index: string]: string | number }`;
      const act = (): any => v.assertMatches({ num: true, str: 'x' });
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.num to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.num to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
      assert.throws(act, ValidatorAssertionError);
    });

    test('rejects when an optional property in the input value does not match the index type', () => {
      const v = validator`{ num: number, str?: string | boolean, [index: string]: string | number }`;
      const act = (): any => v.assertMatches({ num: 2, str: true });
      assert.throws(act, {
        message: [
          'Failed to match against every variant of a union.',
          '  Variant 1: Expected <receivedValue>.str to be of type "string" but got type "boolean".',
          '  Variant 2: Expected <receivedValue>.str to be of type "number" but got type "boolean".',
        ].join('\n'),
      });
      assert.throws(act, ValidatorAssertionError);
    });

    test('explicit properties are still enforced, even when an index type is also present', () => {
      const v = validator`{ [index: string]: string | number, num: number }`;
      // Object the index type, but not the `num` type.
      const act = (): any => v.assertMatches({ num: 'xyz' });
      assert.throws(act, { message: 'Expected <receivedValue>.num to be of type "number" but got type "string".' });
      assert.throws(act, ValidatorAssertionError);
    });

    test('index type restrictions only apply to its index key type', () => {
      const v = validator`{ [index: 'another']: number, num: string }`;
      v.assertMatches({ num: 'xyz' });
      v.assertMatches({ num: 'xyz', someOtherProp: 'xyz' });
      expect(v.matches({ another: 'xyz' })).toBe(false);
    });

    test('index type applies to non-enumerable properties', () => {
      const v = validator`{ [index: string]: number }`;
      const inputObj = {};
      Object.defineProperty(inputObj, 'x', {
        value: true,
        enumerable: false,
      });
      const act = (): any => v.assertMatches(inputObj);
      assert.throws(act, { message: 'Expected <receivedValue>.x to be of type "number" but got type "boolean".' });
      assert.throws(act, ValidatorAssertionError);
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
      const act = (): any => v.assertMatches({ [Symbol('symName')]: 'oops' });
      assert.throws(act, { message: 'Expected <receivedValue>[Symbol(symName)] to be of type "number" but got type "string".' });
      assert.throws(act, ValidatorAssertionError);
    });

    test('able to show unnamed symbols in error messages', () => {
      const v = validator`{ [symb: symbol]: number }`;
      // eslint-disable-next-line symbol-description
      const act = (): any => v.assertMatches({ [Symbol()]: 'oops' });
      assert.throws(act, { message: 'Expected <receivedValue>[Symbol()] to be of type "number" but got type "string".' });
      assert.throws(act, ValidatorAssertionError);
    });
  });

  describe('dynamic keys', () => {
    test('accepts an object that matches the required dynamically-keyed entry', () => {
      const v = validator`{ [${'hello'}]: 'world'}`;
      v.assertMatches({ hello: 'world' });
    });

    test("rejects an object who's value does not match the required dynamically-keyed entry", () => {
      const v = validator`{ [${'hello'}]: 'world'}`;
      const act = (): any => v.assertMatches({ hello: 'not world' });
      assert.throws(act, { message: 'Expected <receivedValue>.hello to be "world" but got "not world".' });
      assert.throws(act, ValidatorAssertionError);
    });

    test("rejects an object that's missing the required dynamically-keyed entry", () => {
      const v = validator`{ [${'hello'}]: 'world'}`;
      const act = (): any => v.assertMatches({ hello2: 'world' });
      assert.throws(act, { message: '<receivedValue> is missing the required properties: "hello"' });
      assert.throws(act, ValidatorAssertionError);
    });

    test('dynamic keys can be optional', () => {
      const v = validator`{ [${42}]?: 24 }`;
      expect(v.matches({ 42: 24 })).toBe(true);
      expect(v.matches({ 42: 25 })).toBe(false);
      expect(v.matches({})).toBe(true);
    });

    test('works with numeric keys', () => {
      const v = validator`{ [${42}]: 24 }`;
      expect(v.matches({ 42: 24 })).toBe(true);
      expect(v.matches({ 42: 25 })).toBe(false);
      expect(v.matches({})).toBe(false);
    });

    test('works with symbol keys', () => {
      const symb = Symbol('testSymb');
      const v = validator`{ [${symb}]: 24 }`;
      expect(v.matches({ [symb]: 24 })).toBe(true);

      const act1 = (): any => v.assertMatches({ [symb]: 25 });
      assert.throws(act1, { message: 'Expected <receivedValue>[Symbol(testSymb)] to be 24 but got 25.' });

      const act2 = (): any => v.assertMatches({});
      assert.throws(act2, { message: '<receivedValue> is missing the required properties: Symbol(testSymb)' });
    });

    test('rejects boolean dynamic keys', () => {
      const v = validator`{ [${true}]: 42 }`;
      const act = (): any => v.assertMatches({});
      assert.throws(act, {
        message: (
          'Attempted to match against a mal-formed validator instance. ' +
          'Its interpolation #1 must be either of type string, symbol, or number. ' +
          'Got type boolean.'
        ),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('rejects boxed string dynamic keys', () => {
      // eslint-disable-next-line no-new-wrappers
      const v = validator`{ x: ${41}, [${new String('value')}]: 42 }`;
      const act = (): any => v.assertMatches({});
      assert.throws(act, {
        message: (
          'Attempted to match against a mal-formed validator instance. ' +
          'Its interpolation #2 must be either of type string, symbol, or number. ' +
          'Got type object.'
        ),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('works with duplicate dynamic keys', () => {
      const v = validator`{ [${'x'}]: { a: 1 }, x: { b: 2 }, [${'x'}]?: { c: 3 } }`;
      expect(v.matches({ x: { a: 1, b: 2, c: 3 } })).toBe(true);

      expect(v.matches({ x: { b: 2, c: 3 } })).toBe(false);
      expect(v.matches({ x: { a: 1, c: 3 } })).toBe(false);
      expect(v.matches({ x: { a: 1, b: 2 } })).toBe(false);
      expect(v.matches({ x: { a: 1, b: 2, c: 'x' } })).toBe(false);

      const act = (): any => v.assertMatches({ x: { a: 1, b: 2 } });
      assert.throws(act, { message: '<receivedValue>.x is missing the required properties: "c"' });
    });

    test('an entry is optional if all duplicate keys are optional', () => {
      // all are optional
      const v1 = validator`{ [${'x'}]?: undefined, x?: undefined, [${'x'}]?: undefined }`;
      expect(v1.matches({ x: undefined })).toBe(true);
      expect(v1.matches({ x: 2 })).toBe(false);
      expect(v1.matches({})).toBe(true);

      // not all are optional
      const v2 = validator`{ [${'x'}]?: undefined, x?: undefined, [${'x'}]: undefined }`;
      expect(v2.matches({ x: undefined })).toBe(true);
      expect(v2.matches({ x: 2 })).toBe(false);
      expect(v2.matches({})).toBe(false);
    });
  });

  test('produces the correct rule', () => {
    const v = validator`{ "numKey\n": number, strKey?: string, [${42}]: boolean, [${43}]?: undefined }`;
    assert(v.rule.category === 'object');

    // v.rule.content
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

    // v.rule.dynamicContent
    expect(v.rule.dynamicContent).toBeInstanceOf(FrozenMap);
    expect(v.rule.dynamicContent.size).toBe(2);
    expect(v.rule.dynamicContent.get(0)).toMatchObject({
      optional: false,
      rule: {
        category: 'simple',
        type: 'boolean',
      },
    });
    expect(v.rule.dynamicContent.get(1)).toMatchObject({
      optional: true,
      rule: {
        category: 'simple',
        type: 'undefined',
      },
    });

    // v.rule.index
    expect(v.rule.index).toBe(null);

    // Is everything frozen?
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('numKey\n'))).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('strKey'))).toBe(true);
    expect(Object.isFrozen(v.rule.dynamicContent.get(0))).toBe(true);
    expect(Object.isFrozen(v.rule.dynamicContent.get(1))).toBe(true);
  });

  test('produces the correct rule with an indexed type', () => {
    const v = validator`{ alwaysPresentKey: string, [index: "someOtherKey"]: string }`;
    assert(v.rule.category === 'object');

    // v.rule.content
    expect(v.rule.content).toBeInstanceOf(FrozenMap);
    expect(v.rule.content.size).toBe(1);
    expect(v.rule.content.get('alwaysPresentKey')).toMatchObject({
      optional: false,
      rule: {
        category: 'simple',
        type: 'string',
      },
    });

    // v.rule.dynamicContent
    expect(v.rule.dynamicContent).toBeInstanceOf(FrozenMap);
    expect(v.rule.dynamicContent.size).toBe(0);

    // v.rule.index
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

    // Is everything frozen?
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.content.get('alwaysPresentKey'))).toBe(true);
    expect(Object.isFrozen(v.rule.index)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator`{x :string ,y ? :number, [ index :"someOtherKey" ] :string ,[ ${'z'} ] ? : 2}`;
    assert(v.rule.category === 'object');
    expect(v.rule.content.size).toBe(2);
    expect(v.rule.content.get('x')).toMatchObject({
      optional: false,
      rule: {
        category: 'simple',
        type: 'string',
      },
    });
    expect(v.rule.content.get('y')).toMatchObject({
      optional: true,
      rule: {
        category: 'simple',
        type: 'number',
      },
    });
    expect(v.rule.dynamicContent.size).toBe(1);
    expect(v.rule.dynamicContent.get(0)).toMatchObject({
      optional: true,
      rule: {
        category: 'primitiveLiteral',
        value: 2,
      },
    });
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
  });

  describe('Syntax errors', () => {
    test('throws on invalid object key', () => {
      const act = (): any => validator`{ ||`;
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { ||',
          '    ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('allows "$" and "_" in keys', () => {
      const v = validator`{ $_: string }`;
      v.assertMatches({ $_: 'xyz' });
    });

    test('allows numeric keys', () => {
      const v = validator`{ 42: string }`;
      v.assertMatches({ 42: 'xyz' });
    });

    test('throws on number keys with special characters', () => {
      const act = (): any => validator`{ 2.3: string }`;
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { 2.3: string }',
          '    ~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('throws on missing colon', () => {
      const act = (): any => validator`{ myKey ||`;
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 9)',
          '  { myKey ||',
          '          ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
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
      assert.throws(act, {
        message: [
          'Expected a comma (`,`) or closing bracket (`}`). (line 1, col 16)',
          '  { key1: number key2: number }',
          '                 ~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('allows a trailing comma', () => {
      validator`{ key1: number, }`;
    });

    test('allows a trailing semicolon', () => {
      validator`{ key1: number; }`;
    });

    test('forbids an empty object with a separator character', () => {
      const act = (): any => validator`{ , }`;
      assert.throws(act, {
        message: [
          'Expected an object key or closing bracket (`}`). (line 1, col 3)',
          '  { , }',
          '    ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('forbids duplicate keys', () => {
      const act = (): any => validator`{ x: 2, "x"?: 2 }`;
      assert.throws(act, {
        message: [
          'Duplicate key "x" found. (line 1, col 9)',
          // It's not ideal that the "?" is underlined, but its good enough.
          '  { x: 2, "x"?: 2 }',
          '          ~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });
  });

  describe('dynamic key syntax errors', () => {
    test("token after dynamic key syntax's `[` must be an interpolation point", () => {
      const act = (): any => validator`{ ["hi"]: number }`;
      assert.throws(act, {
        message: [
          'Expected an identifier, followed by ":" and a type, if this is meant to be a mapped type,',
          'or expected an interpolated value if this is meant to be a dynamic key. (line 1, col 4)',
          '  { ["hi"]: number }',
          '     ~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('a right bracket must close the index key definition', () => {
      const act = (): any => validator`{ [${2} string }`;
      assert.throws(act, {
        message: [
          'Expected a closing right bracket (`]`). (line 1, col 5)',
          '  { [${…} string }',
          '          ~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('Can not give a dynamic key a type', () => {
      // Just testing that you can't somehow mix the index syntax and the dynamic key syntax together.
      const act = (): any => validator`{ [${2}: number]: string }`;
      assert.throws(act, {
        message: [
          'Expected a closing right bracket (`]`). (line 1, col 4)',
          '  { [${…}: number]: string }',
          '         ~',
        ].join('\n'),
      });
    });
  });

  describe('index type syntax errors', () => {
    test("token after index syntax's `[` must be an identifier", () => {
      const act = (): any => validator`{ [2: string]: number }`;
      assert.throws(act, {
        message: [
          'Expected an identifier, followed by ":" and a type, if this is meant to be a mapped type,',
          'or expected an interpolated value if this is meant to be a dynamic key. (line 1, col 4)',
          '  { [2: string]: number }',
          '     ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('a colon must separate an index name and its type.', () => {
      const act = (): any => validator`{ [index]: number }`;
      assert.throws(act, {
        message: [
          "Expected a colon here to separate the index key's name on the left, from a type on the right. (line 1, col 9)",
          '  { [index]: number }',
          '          ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test("a valid type must appear after the index key's colon", () => {
      const act = (): any => validator`{ [index: @]: number }`;
      assert.throws(act, {
        message: [
          'Expected to find a type here. (line 1, col 11)',
          '  { [index: @]: number }',
          '            ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('a right bracket must close the index key definition', () => {
      const act = (): any => validator`{ [index: string number }`;
      assert.throws(act, {
        message: [
          'Expected a closing right bracket (`]`). (line 1, col 18)',
          '  { [index: string number }',
          '                   ~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('a colon must follow the right bracket', () => {
      const act = (): any => validator`{ [index: string] number }`;
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 19)',
          '  { [index: string] number }',
          '                    ~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('can not mix index type syntax with optional property syntax', () => {
      const act = (): any => validator`{ [index: string]?: number }`;
      assert.throws(act, {
        message: [
          'Expected a colon (`:`) to separate the key from the value. (line 1, col 18)',
          '  { [index: string]?: number }',
          '                   ~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });

    test('can not have multiple index types in the same object', () => {
      const act = (): any => validator`{ [index: string]: number, [index2: string]: boolean }`;
      assert.throws(act, {
        message: [
          'Can not have multiple index types in the same object. (line 1, col 28)',
          '  { [index: string]: number, [index2: string]: boolean }',
          '                             ~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
      assert.throws(act, ValidatorSyntaxError);
    });
  });
});
