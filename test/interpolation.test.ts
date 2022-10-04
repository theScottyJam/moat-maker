import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('interpolation', () => {
  describe('misc', () => {
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
  });

  describe('primitive value interpolation', () => {
    test('accepts an identical number', () => {
      const v = validator`${23}`;
      v.assertMatches(23);
    });

    test('Rejects different values of the same type', () => {
      const v = validator`${23}`;
      const act = (): any => v.assertMatches(24);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be the value 23 but got 24.' });
    });

    test('Rejects a different value type', () => {
      const v = validator`${23}`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be the value 23 but got "xyz".' });
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
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got "x\\ny".' });
      });

      test('formats a number', () => {
        const act = (): any => validator`${2}`.assertMatches(3);
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got 3.' });
      });

      test('formats a bigint', () => {
        const act = (): any => validator`${2}`.assertMatches(2n);
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got 2n.' });
      });

      test('formats a boolean', () => {
        // eslint-disable-next-line symbol-description
        const act = (): any => validator`${Symbol('a')}`.assertMatches(Symbol());
        assert.throws(act, { message: 'Expected <receivedValue> to be the value Symbol(a) but got Symbol().' });
      });

      test('formats null', () => {
        const act = (): any => validator`${2}`.assertMatches(null);
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got null.' });
      });

      test('formats undefined', () => {
        const act = (): any => validator`${2}`.assertMatches(undefined);
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got undefined.' });
      });

      test('formats a received object', () => {
        const act = (): any => validator`${2}`.assertMatches({ x: 2 });
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got [object Object].' });
      });

      test('formats a received function', () => {
        // eslint-disable-next-line prefer-arrow-callback
        const act = (): any => validator`${2}`.assertMatches(function test() {});
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got `test`.' });
      });

      test('formats a received anonymous function', () => {
        const act = (): any => validator`${2}`.assertMatches(() => {});
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got [anonymous function/class].' });
      });

      test('formats a primitive wrapper instances as an object', () => {
        // eslint-disable-next-line no-new-wrappers
        const act = (): any => validator`${2}`.assertMatches(new Number(2));
        assert.throws(act, { message: 'Expected <receivedValue> to be the value 2 but got [object Number].' });
      });
    });
  });

  describe('primitive class interpolation', () => {
    test('the Number class matches a numeric primitive', () => {
      const v = validator`${Number}`;
      v.assertMatches(23);
    });

    test('the Number class matches a boxed number', () => {
      const v = validator`${Number}`;
      v.assertMatches(Number(23));
    });

    test('the Number class does not match a string primitive', () => {
      const v = validator`${Number}`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>, which is "xyz", to match `Number` (via its validatable protocol).' });
    });

    test('the Number class does not match an inherited boxed primitive', () => {
      class MyNumber extends Number {}
      const v = validator`${Number}`;
      const act = (): any => v.assertMatches(new MyNumber(3));
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>, which is [object MyNumber], to match `Number` (via its validatable protocol).' });
    });
  });

  describe('native class interpolation', () => {
    test('the Map class matches a map instance', () => {
      const v = validator`${Map}`;
      v.assertMatches(new Map());
    });

    test('the Map class does not match a normal object', () => {
      const v = validator`${Map}`;
      const act = (): any => v.assertMatches({ x: 2 });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which is [object Object], to match `Map` ' +
          '(via its validatable protocol).'
        ),
      });
    });

    describe('error formatting', () => {
      test('the Map class does not match a null-prototype object', () => {
        const act = (): any => validator`${Map}`.assertMatches(Object.create(null));
        assert.throws(act, { message: 'Expected <receivedValue>, which is [object Object], to match `Map` (via its validatable protocol).' });
      });

      test('the Map class does not match an inherited instance of Map', () => {
        class MyMap extends Map {}
        const act = (): any => validator`${Map}`.assertMatches(new MyMap());
        assert.throws(act, { message: 'Expected <receivedValue>, which is [object MyMap], to match `Map` (via its validatable protocol).' });
      });
    });
  });

  describe('userland protocol implementations', () => {
    test('accepts if validatable does not throw', () => {
      const v = validator`${{ [validator.validatable]: () => ({ matched: true }) }}`;
      v.assertMatches(2);
    });

    test('rejects if validatable throws', () => {
      const v = validator`${{
        [validator.validatable]: () => {
          throw new ValidatorAssertionError('Whoops');
        },
      }}`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, {
        message: 'Whoops',
      });
    });

    test('protocol function receives value being matched', () => {
      let receivedValue;
      const v = validator`${{
        [validator.validatable]: (receivedValue_: unknown) => {
          receivedValue = receivedValue_;
        },
      }}`;
      v.assertMatches(2);
      expect(receivedValue).toBe(2);
    });

    test('protocol function receives a lookupPath for the value being matched', () => {
      let lookupPath;
      const validatable = {
        [validator.validatable]: (_: unknown, lookupPath_: string) => {
          lookupPath = lookupPath_;
        },
      };
      const v = validator`{ x: { y: ${validatable} } }`;
      v.assertMatches({ x: { y: 0 } });
      expect(lookupPath).toBe('<receivedValue>.x.y');
    });
  });

  describe('Interpolate validator instances', () => {
    test('Allows a value that matches the interpolated validator', () => {
      const v = validator`{ x: ${validator`{ y: number }`}}`;
      v.assertMatches({ x: { y: 2 } });
    });

    test('Rejects a value that does not match the interpolated validator', () => {
      const v = validator`{ x: ${validator`{ y: number }`}}`;
      const act = (): any => v.assertMatches({ x: { y: 'xyz' } });
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue>.x.y to be of type "number" but got type "string".' });
    });
  });

  describe('interpolating inside a comment', () => {
    test('any interpolation in a block comment is ignored', () => {
      const v = validator`{ x: ${2}, y: /* ${3} */ ${4} }`;
      expect(v.matches({ x: 2, y: 4 })).toBe(true);
      expect(v.matches({ x: 2, y: 3 })).toBe(false);
    });

    test('any interpolation in a single-line comment is ignored', () => {
      const v = validator`{
        x: ${2}, y: // ${3}
        ${4}
      }`;
      expect(v.matches({ x: 2, y: 4 })).toBe(true);
      expect(v.matches({ x: 2, y: 3 })).toBe(false);
    });
  });
});