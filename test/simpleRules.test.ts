/* eslint-disable no-new-wrappers */

import { strict as assert } from 'node:assert';
import { validator } from '../src';

describe('simple rules', () => {
  describe('general', () => {
    test('null values in assertion error has type "null" (not "object", like typeof would give)', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(null);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "null".' });
      assert.throws(act, TypeError);
    });

    test('gives the correct error when matching a primitive against an array', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches([2]);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got an array.' });
      assert.throws(act, TypeError);
    });

    test('gives the correct error when matching a primitive against a function', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(() => {});
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got a function.' });
      assert.throws(act, TypeError);
    });
  });

  describe('string', () => {
    test('accepts string inputs', () => {
      const v = validator`string`;
      v.assertMatches('xyz');
    });

    test('rejects numeric inputs', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('rejects string objects', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(new String('xyz'));
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "object".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`string`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'string',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('number', () => {
    test('accepts numeric inputs', () => {
      const v = validator`number`;
      v.assertMatches(2);
    });

    test('rejects bigint inputs', () => {
      const v = validator`number`;
      const act = (): any => v.assertMatches(2n);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "bigint".' });
      assert.throws(act, TypeError);
    });

    test('rejects number objects', () => {
      const v = validator`number`;
      const act = (): any => v.assertMatches(new Number('hi there'));
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "object".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`number`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'number',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('bigint', () => {
    test('accepts bigint inputs', () => {
      const v = validator`bigint`;
      v.assertMatches(2n);
    });

    test('rejects number inputs', () => {
      const v = validator`bigint`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "bigint" but got type "number".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`bigint`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'bigint',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('boolean', () => {
    test('accepts boolean inputs', () => {
      const v = validator`boolean`;
      v.assertMatches(true);
      v.assertMatches(false);
    });

    test('rejects string inputs', () => {
      const v = validator`boolean`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "boolean" but got type "string".' });
      assert.throws(act, TypeError);
    });

    test('rejects boolean objects', () => {
      const v = validator`boolean`;
      const act = (): any => v.assertMatches(new Boolean(false));
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "boolean" but got type "object".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`boolean`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'boolean',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('symbol', () => {
    test('accepts symbol inputs', () => {
      const v = validator`symbol`;
      v.assertMatches(Symbol('testSymb'));
    });

    test('rejects string inputs', () => {
      const v = validator`symbol`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "symbol" but got type "string".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`symbol`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'symbol',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('object', () => {
    test('accepts object inputs', () => {
      const v = validator`object`;
      v.assertMatches({});
    });

    test('accepts objects with null prototypes', () => {
      const v = validator`object`;
      v.assertMatches(Object.create(null));
    });

    test('accepts functions', () => {
      const v = validator`object`;
      v.assertMatches(() => {});
    });

    test('accepts boxed primitives', () => {
      const v = validator`object`;
      v.assertMatches(new Number(2));
    });

    test('rejects string inputs', () => {
      const v = validator`object`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "object" but got type "string".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`object`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'object',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('null', () => {
    test('accepts null inputs', () => {
      const v = validator`null`;
      v.assertMatches(null);
    });

    test('rejects undefined inputs', () => {
      const v = validator`null`;
      const act = (): any => v.assertMatches(undefined);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "null" but got type "undefined".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`null`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'null',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('undefined', () => {
    test('accepts undefined inputs', () => {
      const v = validator`undefined`;
      v.assertMatches(undefined);
    });

    test('rejects null inputs', () => {
      const v = validator`undefined`;
      const act = (): any => v.assertMatches(null);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "undefined" but got type "null".' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`undefined`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'simple',
          type: 'undefined',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });
});
