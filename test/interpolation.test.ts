/* eslint-disable @typescript-eslint/no-extraneous-class */

import * as vm from 'node:vm';
import { strict as assert } from 'node:assert';
import { validator } from '../src/index.js';

describe('interpolation', () => {
  // The main testing for interpolating lazy-evaluators and expectation instances is done elsewhere

  describe('misc', () => {
    test('produces the correct rule', () => {
      const v = validator`${'xyz'} | ${23}`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
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
        },
        interpolated: ['xyz', 23],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });

    test('works with funky whitespace', () => {
      const v = validator`${'xyz'}|${23}`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
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
        },
        interpolated: ['xyz', 23],
      });
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
      assert.throws(act, { message: 'Expected <receivedValue> to be the value 23 but got 24.' });
      assert.throws(act, TypeError);
    });

    test('Rejects a different value type', () => {
      const v = validator`${23}`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be the value 23 but got "xyz".' });
      assert.throws(act, TypeError);
    });

    test('No interpolation points produces an empty interpolated array', () => {
      const v = validator`string`;
      expect(v.ruleset.interpolated).toMatchObject([]);
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
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was "xyz", to be an instance of `Number`.',
      });
      assert.throws(act, TypeError);
    });

    test('the Number class matches an inherited boxed primitive', () => {
      class MyNumber extends Number {}
      const v = validator`${Number}`;
      v.assertMatches(new MyNumber(3));
    });

    // Symbol.hasInstance is ignored, because TypeScript technically ignores it as well
    // when it is deciding if one thing is an instance of another.
    test('ignores Symbol.hasInstance', () => {
      class EverythingIsASubclassOfMe {
        static [Symbol.hasInstance] = (): boolean => true;
      }

      assert({} instanceof EverythingIsASubclassOfMe);
      expect(validator`${EverythingIsASubclassOfMe}`.matches({})).toBe(false);
    });

    // It's not very useful to do so, but you can do it.
    test('you can interpolate function expressions', () => {
      expect(validator`${(function() {}) as any}`.matches(() => {})).toBe(false);
    });

    // It's not very useful to do so, but you can do it.
    test('you can interpolate arrow functions', () => {
      expect(validator`${(() => {}) as any}`.matches(() => {})).toBe(false);
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
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was [object Object], to be an instance of `Map`.',
      });
      assert.throws(act, TypeError);
    });

    test('the Map class does not match a null-prototype object', () => {
      const act = (): any => validator`${Map}`.assertMatches(Object.create(null));
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was [object Object], to be an instance of `Map`.',
      });
    });

    test('the Map class matches an inherited instance of Map', () => {
      class MyMap extends Map {}
      validator`${Map}`.assertMatches(new MyMap());
    });

    test('a Map class from one realm matches a Map instance from another', () => {
      const RealmMap = vm.runInNewContext('Map');
      validator`${RealmMap}`.assertMatches(new Map());
    });

    test('a Map class from one realm matches a derived Map instance from another', () => {
      const RealmMap = vm.runInNewContext('Map');
      class MyMap extends Map {}
      validator`${RealmMap}`.assertMatches(new MyMap());
    });

    test('a Map class from one realm does not match a Set instance from another', () => {
      const RealmMap = vm.runInNewContext('Map');
      const act = (): any => validator`${RealmMap}`.assertMatches(new Set());
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was [object Set], to be an instance of `Map`.',
      });
    });
  });

  describe('userland class interpolation', () => {
    test('a userland class matches its own instances', () => {
      class Thing {}
      const v = validator`${Thing}`;
      v.assertMatches(new Thing());
    });

    test('a userland class does not match a normal object', () => {
      class Thing {}
      const v = validator`${Thing}`;
      const act = (): any => v.assertMatches({ x: 2 });
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was [object Object], to be an instance of `Thing`.',
      });
      assert.throws(act, TypeError);
    });

    test('a userland class does not match a null-prototype object', () => {
      class Thing {}
      const act = (): any => validator`${Thing}`.assertMatches(Object.create(null));
      assert.throws(act, {
        message: 'Expected <receivedValue>, which was [object Object], to be an instance of `Thing`.',
      });
    });

    test('a userland class matches an inherited instance', () => {
      class Thing {}
      class DerivedThing extends Thing {}
      validator`${Thing}`.assertMatches(new DerivedThing());
    });
  });

  describe('interpolate regular expressions', () => {
    test('accepts a matching value', () => {
      const v = validator`${/^\d{3}$/}`;
      v.assertMatches('234');
    });

    test('rejects a non-matching value', () => {
      const v = validator`${/^\d{3}$/g}`;
      const act = (): any => v.assertMatches('2345');
      assert.throws(act, { message: 'Expected <receivedValue>, which was "2345", to match the regular expression /^\\d{3}$/g' });
      assert.throws(act, TypeError);
    });

    test('rejects a non-string value', () => {
      const v = validator`${/^\d{3}$/g}`;
      const act = (): any => v.assertMatches(2345);
      assert.throws(act, { message: 'Expected <receivedValue>, which was 2345, to be a string that matches the regular expression /^\\d{3}$/g' });
      assert.throws(act, TypeError);
    });

    test('resets the lastIndex property when `g` flag is set (because it internally uses string.matches(regex))', () => {
      const regex = /ab/g;
      const v = validator`${regex}`;
      regex.lastIndex = 3;
      v.assertMatches('abxxxabxxxab');
      expect(regex.lastIndex).toBe(0);
    });

    test('does not reset the lastIndex property when `g` flag is not set', () => {
      const regex = /ab/;
      const v = validator`${regex}`;
      regex.lastIndex = 3;
      v.assertMatches('abxxxabxxxab');
      expect(regex.lastIndex).toBe(3);
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
      assert.throws(act, { message: 'Expected <receivedValue>.x.y to be of type "number" but got type "string".' });
      assert.throws(act, TypeError);
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

  test('expectation failures at "parent" lookup paths are not auto-pruned.', () => {
    const expectNothing = validator.expectTo(x => 'fail');
    const v = validator`${expectNothing} | { x: 2 }`;
    const act = (): any => v.assertMatches({ x: 3 });
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>, which was [object Object], to fail',
        '  * Expected <receivedValue>.x to be 2 but got 3.',
      ].join('\n'),
    });
  });

  test('non-expectation, interpolation failures at "parent" lookup paths can be pruned.', () => {
    const v = validator`${'badValue'} | { x: 2 }`;
    const act = (): any => v.assertMatches({ x: 3 });
    assert.throws(act, {
      message: 'Expected <receivedValue>.x to be 2 but got 3.',
    });
  });
});
