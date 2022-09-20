import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError } from '../src';

describe('interpolation', () => {
  describe('primitive interpolation', () => {
    test('accepts an identical number', () => {
      const v = validator`${23}`;
      v.assertMatches(23);
    });

    test('Rejects dififerent values of the same type', () => {
      const v = validator`${23}`;
      const act = (): any => v.assertMatches(24);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected the value 23 but got 24.' });
    });

    test('Rejects a different value type', () => {
      const v = validator`${23}`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected the value 23 but got "xyz".' });
    });

    test('produces the correct rule', () => {
      const v = validator`${'xyz'} | ${23}`;
      expect(v.rule).toMatchObject({
        category: 'union',
        variants: [
          {
            category: 'interpolation',
            interpolationIndex: 0,
          }, {
            category: 'interpolation',
            interpolationIndex: 1,
          },
        ],
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
      expect(v.interpolated).toMatchObject(['xyz', 23]);
      expect(Object.isFrozen(v.interpolated)).toBe(true);
    });

    test('No interpolation points produces an empty interpolated array', () => {
      const v = validator`string`;
      expect(v.interpolated).toMatchObject([]);
    });

    describe('uses sameValueZero comparison algorithm', () => {
      test('considers zero and negative zero as equal', () => {
        const v = validator`${0}`;
        v.assertMatches(-0);
      });

      test('considers NaN to be equal to NaN', () => {
        const v = validator`${NaN}`;
        v.assertMatches(NaN);
      });
    });

    describe('error formatting', () => {
      test('formats a string with special characters', () => {
        const act = (): any => validator`${2}`.assertMatches('x\ny');
        assert.throws(act, { message: 'Expected the value 2 but got "x\\ny".' });
      });

      test('formats a number', () => {
        const act = (): any => validator`${2}`.assertMatches(3);
        assert.throws(act, { message: 'Expected the value 2 but got 3.' });
      });

      test('formats a bigint', () => {
        const act = (): any => validator`${2}`.assertMatches(2n);
        assert.throws(act, { message: 'Expected the value 2 but got 2n.' });
      });

      test('formats a boolean', () => {
        // eslint-disable-next-line symbol-description
        const act = (): any => validator`${Symbol('a')}`.assertMatches(Symbol());
        assert.throws(act, { message: 'Expected the value Symbol(a) but got Symbol().' });
      });

      test('formats null', () => {
        const act = (): any => validator`${2}`.assertMatches(null);
        assert.throws(act, { message: 'Expected the value 2 but got null.' });
      });

      test('formats undefined', () => {
        const act = (): any => validator`${2}`.assertMatches(undefined);
        assert.throws(act, { message: 'Expected the value 2 but got undefined.' });
      });

      test('formats a recieved object', () => {
        const act = (): any => validator`${2}`.assertMatches({ x: 2 });
        assert.throws(act, { message: 'Expected the value 2 but got an object.' });
      });

      test('formats a recieved function', () => {
        const act = (): any => validator`${2}`.assertMatches(() => {});
        assert.throws(act, { message: 'Expected the value 2 but got a function.' });
      });

      test('formats a primitive wrapper instances as an object', () => {
        // eslint-disable-next-line no-new-wrappers
        const act = (): any => validator`${2}`.assertMatches(new Number(2));
        assert.throws(act, { message: 'Expected the value 2 but got an object.' });
      });
    });
  });
});
