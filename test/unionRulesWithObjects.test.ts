import { strict as assert } from 'node:assert';
import { validator } from '../src';

describe('union rules with objects', () => {
  test('fails to match both union variants (test 1)', () => {
    const v = validator`{ x: number } | { y: string }`;
    const act = (): any => v.assertMatches({ y: 2 });
    assert.throws(act, {
      message: 'Expected <receivedValue>.y to be of type "string" but got type "number".',
    });
  });

  test('fails to match both union variants (test 2)', () => {
    const v = validator`{ x: number } | { y: number }`;
    const act = (): any => v.assertMatches({});
    assert.throws(act, {
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: <receivedValue> is missing the required properties: "x"',
        '  Variant 2: <receivedValue> is missing the required properties: "y"',
      ].join('\n'),
    });
  });

  test('fails to match both union variants (test 3)', () => {
    const v = validator`{ x: number } | { x: string }`;
    const act = (): any => v.assertMatches({ x: true });
    assert.throws(act, {
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue>.x to be of type "number" but got type "boolean".',
        '  Variant 2: Expected <receivedValue>.x to be of type "string" but got type "boolean".',
      ].join('\n'),
    });
  });

  describe('if all required keys are found for an object variant, sibling rule errors are omitted', () => {
    test('primitive sibling rule errors are ignored', () => {
      const v = validator`number | { x: 2 } | { x: 3 }`;
      const act = (): any => v.assertMatches({ x: 0 });
      assert.throws(act, {
        message: [
          'Failed to match against any variant of a union.',
          '  Variant 1: Expected <receivedValue>.x to be 2 but got 0.',
          '  Variant 2: Expected <receivedValue>.x to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sibling object rule errors with missing keys are ignored (test 1)', () => {
      const v = validator`{ x: 2 } | { sub: { y: 2 } } | { sub: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { y: 0 } });
      assert.throws(act, {
        message: [
          'Failed to match against any variant of a union.',
          '  Variant 1: Expected <receivedValue>.sub.y to be 2 but got 0.',
          '  Variant 2: Expected <receivedValue>.sub.y to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sibling object rule errors with missing keys are ignored (test 2)', () => {
      const v = validator`{ x: 2 } | { sub: { y: 2 } } | { sub: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: 'bad value' });
      assert.throws(act, {
        message: 'Expected <receivedValue>.sub to be an object but got "bad value".',
      });
    });

    test('does not throw a union-style error if there is only one non-ignored union variant', () => {
      const v = validator`number | { x: 2 }`;
      const act = (): any => v.assertMatches({ x: 0 });
      assert.throws(act, {
        message: 'Expected <receivedValue>.x to be 2 but got 0.',
      });
    });
  });

  describe('picking object variants to travel down, when there are multiple potential options', () => {
    // This "picking a variant to travel down" behavior can lead to error messages that don't
    // fully explain everything that could be wrong. These error messages tend to be of a similar quality to
    // TypeScript's error messages, so I'm not overly worried about it. And, if we don't pick-and-choose,
    // we may run into errors that are extremely large, due to the many possible things that could have gone wrong
    // at every step of the nesting process. Though, ideally, we would still leave some sort of note stating that
    // they may be other ways to fix the issue then what's stated in the error message - maybe in a future release.

    test('fail to match all variants, because deep primitive properties are incorrect', () => {
      const v = validator`{ sub: { y: 2 } } | { sub: { y: 3 } } | { sub2: { y: 2 } } | { sub2: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { y: 0 }, sub2: { y: 0 } });
      assert.throws(act, {
        message: [
          'Failed to match against any variant of a union.',
          '  Variant 1: Expected <receivedValue>.sub.y to be 2 but got 0.',
          '  Variant 2: Expected <receivedValue>.sub.y to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sub-objects are missing properties required by all variants', () => {
      const v = validator`{ sub: { x: 2 } } | { sub2: { y: 2 } }`;
      const act = (): any => v.assertMatches({ sub: {}, sub2: {} });
      assert.throws(act, {
        message: '<receivedValue>.sub is missing the required properties: "x"',
      });
    });

    test('sub-objects are missing required and optional properties', () => {
      const v = validator`{ sub: { w?: 2, x: 0 } } | { sub2: { y?: 2, z: 0 } }`;
      const act = (): any => v.assertMatches({ sub: {}, sub2: {} });
      assert.throws(act, {
        message: '<receivedValue>.sub is missing the required properties: "x"',
      });
    });
  });

  describe('if you correctly match one union variant, you can not improperly match another variant', () => {
    test('you can not set incorrect required fields of the unmatched union variant.', () => {
      const v = validator`{ type: 'A', value: 1 } | { type: 'B' }`;
      const act = (): any => v.assertMatches({ type: 'B', value: 2 });
      assert.throws(act, {
        message: 'Expected <receivedValue>.value to be 1 but got 2.',
      });
    });

    test('you can not set incorrect optional fields of the unmatched union variant.', () => {
      const v = validator`{ type: 'A', value?: 1 } | { type: 'B' }`;
      const act = (): any => v.assertMatches({ type: 'B', value: 2 });
      assert.throws(act, {
        message: 'Expected <receivedValue>.value to be 1 but got 2.',
      });
    });
  });

  test('properly builds a union error that works with repeated dynamic properties', () => {
    const v = validator`{ [${'a'}]: number, [${'a'}]: 0 } | { [${'a'}]: 1 }`;
    const act = (): any => v.assertMatches({ a: 2 });
    assert.throws(act, {
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue>.a to be 0 but got 2.',
        '  Variant 2: Expected <receivedValue>.a to be 1 but got 2.',
      ].join('\n'),
    });
  });

  describe('index types', () => {
    test('simple index usage works inside a union (test 1)', () => {
      const v = validator`{ type: 'A', [index: number]: number } | { type: 'B', 0: string }`;
      v.assertMatches({ type: 'A', 1: 1 });
    });

    test('simple index usage works inside a union (test 2)', () => {
      const v = validator`{ type: 'A', [index: number]: number } | { type: 'B', 0: string }`;
      const act = (): any => v.assertMatches({ type: 'A', 0: 'xyz' });
      assert.throws(act, {
        message: 'Expected <receivedValue>.type to be "B" but got "A".',
      });
    });

    test('a key matches the index type from one variant, and a required property from another', () => {
      const v = validator`{ type: 'A', [index: number]: number } | { type: 'B', 0: string }`;
      // The `type` property matches the first union, which normally means we can't supply any properties that
      // match the keys on the second variant and has invalid value types (like `0` with a numeric value).
      // This, however, works anyways, because the `0` key also matches the index type on the first union.
      // (You can see this in action, if you take out the index rule, then see an error pop up)
      v.assertMatches({ type: 'A', 0: 2 });
    });

    test('if you match the union variant that does not have the index type, you are not constrained by it', () => {
      const v = validator`{ type: 'A', [index: number]: number } | { type: 'B', 0: string }`;
      v.assertMatches({ type: 'B', 0: 'x', 1: 'x' });
    });

    test('matching the "outward" parts of rules of two index types at once (test 1)', () => {
      const v = validator`{ [index: string]: { subobj: { y: 1 } } } | { [index: string]: { subobj: { y: 2 } } }`;
      v.assertMatches({ myprop: { subobj: { y: 2 } } });
    });

    test('matching the "outward" parts of rules of two index types at once (test 2)', () => {
      const v = validator`{ [index: string]: { subobj: { y: 1 } } } | { [index: string]: { subobj: { y: 2 } } }`;
      const act = (): any => v.assertMatches({ myprop: { subobj: { y: 5 } } });
      assert.throws(act, {
        message: [
          'Failed to match against any variant of a union.',
          '  Variant 1: Expected <receivedValue>.myprop.subobj.y to be 1 but got 5.',
          '  Variant 2: Expected <receivedValue>.myprop.subobj.y to be 2 but got 5.',
        ].join('\n'),
      });
    });

    test('merging index types with other properties on the same union variant (test 1)', () => {
      const v = validator`{ type: 'A', [index: number]: { x: 2 }, 0: { y: 3 } } | { type: 'B', 0: string }`;
      v.assertMatches({ type: 'A', 0: { x: 2, y: 3 } });
    });

    test('merging index types with other properties on the same union variant (test 2)', () => {
      const v = validator`{ type: 'A', [index: number]: { x: 2 }, 0: { y: 3 } } | { type: 'B', 0: string }`;
      const act = (): any => v.assertMatches({ type: 'A', 0: { x: 2 } });
      assert.throws(act, {
        message: [
          'Failed to match against any variant of a union.',
          '  Variant 1: <receivedValue>["0"] is missing the required properties: "y"',
          '  Variant 2: Expected <receivedValue>["0"] to be of type "string" but got type "object".',
        ].join('\n'),
      });
    });

    test('merging index types with other properties on the same union variant (test 3)', () => {
      const v = validator`{ type: 'A', [index: number]: { x: 2 }, 0: { y: 3 } } | { type: 'B', 0: string }`;
      const act = (): any => v.assertMatches({ type: 'A', 0: { y: 3 } });
      // TODO: Perhaps it's worth investigating why it's suggesting to change the type.
      assert.throws(act, {
        message: 'Expected <receivedValue>.type to be "B" but got "A".',
      });
    });
  });

  describe('matches properties of different union variants object matchers, instead of matching a single variant', () => {
    test('match error in top-level object matchers', () => {
      const v = validator`{ x: 2, y: 2 } | { x: 3, y: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('match error in nested objects', () => {
      const v = validator`{ sub: { x: 2, y: 2 } } | { sub: { x: 3, y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { x: 2, y: 3 } });
      assert.throws(act, {
        message: (
          "<receivedValue>.sub's properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('match error with optional properties (test 1)', () => {
      const v = validator`{ x?: 2, y?: 2 } | { x?: 3, y?: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('match error with optional properties (test 2)', () => {
      const v = validator`{ x: 2, y: 2 } | { x?: 3, y?: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('matching parts of all three variants in a three-way union', () => {
      const v = validator`{ x: 2, y: 2, z: 2 } | { x: 3, y: 3, z: 3 } | { x: 4, y: 4, z: 4}`;
      const act = (): any => v.assertMatches({ x: 2, y: 3, z: 4 });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('matching parts of just two variants in a three-way union', () => {
      const v = validator`{ x: 2, y: 2, z: 2 } | { x: 3, y: 3, z: 3 } | { x: 4, y: 4, z: 4}`;
      const act = (): any => v.assertMatches({ x: 2, y: 3, z: 3 });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('object matchers includes an index type', () => {
      const v = validator`{ x: 'A', 0: 'A' } | { x: 'B', [index: number]: 'B' }`;
      const act = (): any => v.assertMatches({ x: 'A', 0: 'B' });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });

    test('object matchers includes multiple index types (test 1)', () => {
      const mySymb = Symbol('test symbol');
      const v = validator`{ [index: symbol]: 'A', 0: 'A' } | { [${mySymb}]: 'B', [index: number]: 'B' }`;
      const act = (): any => v.assertMatches({ [mySymb]: 'A', 0: 'B' });
      assert.throws(act, {
        message: (
          "<receivedValue>'s properties matches various union variants " +
          'when it needs to pick a single variant to follow.'
        ),
      });
    });
  });

  test('all union variants have a same required field', () => {
    const v = validator`{ x: number, y: number } | { x: number, z: number }`;
    const act = (): any => v.assertMatches({});
    assert.throws(act, {
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: <receivedValue> is missing the required properties: "x", "y"',
        '  Variant 2: <receivedValue> is missing the required properties: "x", "z"',
      ].join('\n'),
    });
  });

  test('matching against two nested objects that do not overlap at the deeper level (test 1)', () => {
    const v = validator`number | { sub: { y: 0 } } | { sub: { z: 0 } }`;
    const act = (): any => v.assertMatches({ sub: { y: 1, z: 1 } });
    // TODO: It's not an ideal error message, since it doesn't explain that there's two possible union variants that
    // could be matched here. But, this is currently, technically working as designed.
    assert.throws(act, {
      message: 'Expected <receivedValue>.sub.y to be 0 but got 1.',
    });
  });

  test('matching against two nested objects that do not overlap at the deeper level (test 2)', () => {
    const v = validator`number | { sub: { y: 0 } } | { sub: { z: 0 } }`;
    const act = (): any => v.assertMatches({ sub: { y: 1, z: 0 } });
    // It's not an ideal error message, since it doesn't explain that another possible option
    // is to just omit the `y` field. But, for now, it works.
    assert.throws(act, {
      message: 'Expected <receivedValue>.sub.y to be 0 but got 1.',
    });
  });
});
