/* eslint-disable no-new-wrappers */

import { validator, ValidatorAssertionError } from '../src';

describe('simple validators', () => {
  describe('general', () => {
    test('null values in assertion error has type "null" (not "object", like typeof would give)', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(null);
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "string" but got type "null".');
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
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "string" but got type "number".');
    });

    test('rejects string objects', () => {
      const v = validator`string`;
      const act = (): any => v.assertMatches(new String('xyz'));
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "string" but got type "object".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(2);
    });

    test('rejects bigint inputs', () => {
      const v = validator`number`;
      const act = (): any => v.assertMatches(2n);
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "number" but got type "bigint".');
    });

    test('rejects number objects', () => {
      const v = validator`number`;
      const act = (): any => v.assertMatches(new Number('hi there'));
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "number" but got type "object".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(2n);
    });

    test('rejects number inputs', () => {
      const v = validator`bigint`;
      const act = (): any => v.assertMatches(2);
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "bigint" but got type "number".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(true);
      v.assertMatches(false);
    });

    test('rejects string inputs', () => {
      const v = validator`boolean`;
      const act = (): any => v.assertMatches('xyz');
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "boolean" but got type "string".');
    });

    test('rejects boolean objects', () => {
      const v = validator`boolean`;
      const act = (): any => v.assertMatches(new Boolean(false));
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "boolean" but got type "object".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(Symbol('testSymb'));
    });

    test('rejects string inputs', () => {
      const v = validator`symbol`;
      const act = (): any => v.assertMatches('xyz');
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "symbol" but got type "string".');
    });

    test('produces the correct rules', () => {
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
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "object" but got type "string".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(null);
    });

    test('rejects undefined inputs', () => {
      const v = validator`null`;
      const act = (): any => v.assertMatches(undefined);
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "null" but got type "undefined".');
    });

    test('produces the correct rules', () => {
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
      v.assertMatches(undefined);
    });

    test('rejects null inputs', () => {
      const v = validator`undefined`;
      const act = (): any => v.assertMatches(null);
      expect(act).toThrow(ValidatorAssertionError);
      expect(act).toThrow('Expected a value of type "undefined" but got type "null".');
    });

    test('produces the correct rules', () => {
      const v = validator`undefined`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'undefined',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });
  });
});
