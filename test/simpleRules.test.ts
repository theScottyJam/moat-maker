/* eslint-disable no-new-wrappers */

import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError } from '../src';

describe('simple rules', () => {
  describe('general', () => {
    test('null values in assertion error has type "null" (not "object", like typeof would give)', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted(null);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "null".' });
    });

    test('gives the correct error when matching a primitive against an array', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted([2]);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got an array.' });
    });

    test('gives the correct error when matching a primitive against a function', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted(() => {});
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got a function.' });
    });
  });

  describe('string', () => {
    test('accepts string inputs', () => {
      const v = validator`string`;
      v.getAsserted('xyz');
    });

    test('rejects numeric inputs', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "number".' });
    });

    test('rejects string objects', () => {
      const v = validator`string`;
      const act = (): any => v.getAsserted(new String('xyz'));
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "string" but got type "object".' });
    });

    test('produces the correct rule', () => {
      const v = validator`string`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'string',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('number', () => {
    test('accepts numeric inputs', () => {
      const v = validator`number`;
      v.getAsserted(2);
    });

    test('rejects bigint inputs', () => {
      const v = validator`number`;
      const act = (): any => v.getAsserted(2n);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "bigint".' });
    });

    test('rejects number objects', () => {
      const v = validator`number`;
      const act = (): any => v.getAsserted(new Number('hi there'));
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "number" but got type "object".' });
    });

    test('produces the correct rule', () => {
      const v = validator`number`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'number',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('bigint', () => {
    test('accepts bigint inputs', () => {
      const v = validator`bigint`;
      v.getAsserted(2n);
    });

    test('rejects number inputs', () => {
      const v = validator`bigint`;
      const act = (): any => v.getAsserted(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "bigint" but got type "number".' });
    });

    test('produces the correct rule', () => {
      const v = validator`bigint`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'bigint',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('boolean', () => {
    test('accepts boolean inputs', () => {
      const v = validator`boolean`;
      v.getAsserted(true);
      v.getAsserted(false);
    });

    test('rejects string inputs', () => {
      const v = validator`boolean`;
      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "boolean" but got type "string".' });
    });

    test('rejects boolean objects', () => {
      const v = validator`boolean`;
      const act = (): any => v.getAsserted(new Boolean(false));
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "boolean" but got type "object".' });
    });

    test('produces the correct rule', () => {
      const v = validator`boolean`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'boolean',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('symbol', () => {
    test('accepts symbol inputs', () => {
      const v = validator`symbol`;
      v.getAsserted(Symbol('testSymb'));
    });

    test('rejects string inputs', () => {
      const v = validator`symbol`;
      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "symbol" but got type "string".' });
    });

    test('produces the correct rule', () => {
      const v = validator`symbol`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'symbol',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('object', () => {
    test('accepts object inputs', () => {
      const v = validator`object`;
      v.getAsserted({});
    });

    test('accepts objects with null prototypes', () => {
      const v = validator`object`;
      v.getAsserted(Object.create(null));
    });

    test('accepts functions', () => {
      const v = validator`object`;
      v.getAsserted(() => {});
    });

    test('accepts boxed primitives', () => {
      const v = validator`object`;
      v.getAsserted(new Number(2));
    });

    test('rejects string inputs', () => {
      const v = validator`object`;
      const act = (): any => v.getAsserted('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "object" but got type "string".' });
    });

    test('produces the correct rule', () => {
      const v = validator`object`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'object',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('null', () => {
    test('accepts null inputs', () => {
      const v = validator`null`;
      v.getAsserted(null);
    });

    test('rejects undefined inputs', () => {
      const v = validator`null`;
      const act = (): any => v.getAsserted(undefined);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "null" but got type "undefined".' });
    });

    test('produces the correct rule', () => {
      const v = validator`null`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'null',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });

  describe('undefined', () => {
    test('accepts undefined inputs', () => {
      const v = validator`undefined`;
      v.getAsserted(undefined);
    });

    test('rejects null inputs', () => {
      const v = validator`undefined`;
      const act = (): any => v.getAsserted(null);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be of type "undefined" but got type "null".' });
    });

    test('produces the correct rule', () => {
      const v = validator`undefined`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'undefined',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });
});
