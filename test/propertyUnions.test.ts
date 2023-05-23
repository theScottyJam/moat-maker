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
        'One of the following issues needs to be resolved:',
        '  * <receivedValue> is missing the required properties: "x"',
        '  * <receivedValue> is missing the required properties: "y"',
      ].join('\n'),
    });
  });

  test('fails to match both union variants (test 3)', () => {
    const v = validator`{ x: number } | { x: string }`;
    const act = (): any => v.assertMatches({ x: true });
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>.x to be of type "number" but got type "boolean".',
        '  * Expected <receivedValue>.x to be of type "string" but got type "boolean".',
      ].join('\n'),
    });
  });

  describe('object properties are a union', () => {
    test('given a valid input, the simple case does not throw', () => {
      const v = validator`{ x: 0 | 1 }`;
      v.assertMatches({ x: 0 });
    });

    test('given an invalid input, the simple case properly throws', () => {
      const v = validator`{ x: 0 | 1 }`;
      const act = (): any => v.assertMatches({ x: 2 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.x to be 0 but got 2.',
          '  * Expected <receivedValue>.x to be 1 but got 2.',
        ].join('\n'),
      });
    });

    test('having nested and outer unions with the same property correctly allows valid input (test 1)', () => {
      const v = validator`{ x: 0 | 1 } | { x: 2 }`;
      v.assertMatches({ x: 0 });
    });

    test('having nested and outer unions with the same property correctly allows valid input (test 2)', () => {
      const v = validator`{ x: 0 | 1 } | { x: 2 }`;
      v.assertMatches({ x: 2 });
    });

    test('having nested and outer unions with the same property correctly throws with invalid input', () => {
      const v = validator`{ x: 0 | 1 } | { x: 2 }`;
      const act = (): any => v.assertMatches({ x: 3 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.x to be 0 but got 3.',
          '  * Expected <receivedValue>.x to be 1 but got 3.',
          '  * Expected <receivedValue>.x to be 2 but got 3.',
        ].join('\n'),
      });
    });
  });

  describe('if all required keys are found for an object variant, sibling rule errors are omitted', () => {
    test('primitive sibling rule errors are ignored', () => {
      const v = validator`number | { x: 2 } | { x: 3 }`;
      const act = (): any => v.assertMatches({ x: 0 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.x to be 2 but got 0.',
          '  * Expected <receivedValue>.x to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sibling property rule errors with missing keys are ignored (test 1)', () => {
      const v = validator`{ x: 2 } | { sub: { y: 2 } } | { sub: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { y: 0 } });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.sub.y to be 2 but got 0.',
          '  * Expected <receivedValue>.sub.y to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sibling property rule errors with missing keys are ignored (test 2)', () => {
      const v = validator`{ x: 2 } | { sub: { y: 2 } } | { sub: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: 'bad value' });
      assert.throws(act, {
        message: '<receivedValue>.sub is missing the required properties: "y"',
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

  describe('Following multiple variant paths at once, and collecting errors from them', () => {
    test('fail to match all variants, because deep primitive properties are incorrect', () => {
      const v = validator`{ sub: { y: 2 } } | { sub: { y: 3 } } | { sub2: { y: 2 } } | { sub2: { y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { y: 0 }, sub2: { y: 0 } });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.sub.y to be 2 but got 0.',
          '  * Expected <receivedValue>.sub.y to be 3 but got 0.',
          '  * Expected <receivedValue>.sub2.y to be 2 but got 0.',
          '  * Expected <receivedValue>.sub2.y to be 3 but got 0.',
        ].join('\n'),
      });
    });

    test('sub-objects are missing properties required by all variants', () => {
      const v = validator`{ sub: { x: 2 } } | { sub2: { y: 2 } }`;
      const act = (): any => v.assertMatches({ sub: {}, sub2: {} });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * <receivedValue>.sub is missing the required properties: "x"',
          '  * <receivedValue>.sub2 is missing the required properties: "y"',
        ].join('\n'),
      });
    });

    test('sub-objects are missing required and optional properties', () => {
      const v = validator`{ sub: { w?: 2, x: 0 } } | { sub2: { y?: 2, z: 0 } }`;
      const act = (): any => v.assertMatches({ sub: {}, sub2: {} });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * <receivedValue>.sub is missing the required properties: "x"',
          '  * <receivedValue>.sub2 is missing the required properties: "z"',
        ].join('\n'),
      });
    });
  });

  test('properly builds a union error that works with repeated dynamic properties', () => {
    const v = validator`{ [${'a'}]: number, [${'a'}]: 0 } | { [${'a'}]: 1 }`;
    const act = (): any => v.assertMatches({ a: 2 });
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>.a to be 0 but got 2.',
        '  * Expected <receivedValue>.a to be 1 but got 2.',
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
        message: 'Expected <receivedValue>["0"] to be of type "number" but got type "string".',
      });
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
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.myprop.subobj.y to be 1 but got 5.',
          '  * Expected <receivedValue>.myprop.subobj.y to be 2 but got 5.',
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
        message: '<receivedValue>["0"] is missing the required properties: "y"',
      });
    });

    test('merging index types with other properties on the same union variant (test 3)', () => {
      const v = validator`{ type: 'A', [index: number]: { x: 2 }, 0: { y: 3 } } | { type: 'B', 0: string }`;
      const act = (): any => v.assertMatches({ type: 'A', 0: { y: 3 } });
      assert.throws(act, {
        message: '<receivedValue>["0"] is missing the required properties: "x"',
      });
    });

    test('union with index failure and required key failure', () => {
      const v = validator`{ [index: number]: 1 } | { a: 'b' }`;
      const act = (): any => v.assertMatches({ 0: 2, b: 'b' });
      assert.throws(act, {
        message: 'Expected <receivedValue>["0"] to be 1 but got 2.',
      });
    });

    test('union with index failure and bad property value failure', () => {
      const v = validator`{ [index: number]: 1 } | { a: 'b' }`;
      const act = (): any => v.assertMatches({ 0: 2, a: 'a' });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>["0"] to be 1 but got 2.',
          '  * Expected <receivedValue>.a to be "b" but got "a".',
        ].join('\n'),
      });
    });
  });

  describe('matches properties of different union variants object matchers, instead of matching a single variant', () => {
    test('match error in top-level object matchers', () => {
      const v = validator`{ x: 2, y: 2 } | { x: 3, y: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.y to be 2 but got 3.',
          '  * Expected <receivedValue>.x to be 3 but got 2.',
        ].join('\n'),
      });
    });

    test('match error in nested objects', () => {
      const v = validator`{ sub: { x: 2, y: 2 } } | { sub: { x: 3, y: 3 } }`;
      const act = (): any => v.assertMatches({ sub: { x: 2, y: 3 } });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.sub.y to be 2 but got 3.',
          '  * Expected <receivedValue>.sub.x to be 3 but got 2.',
        ].join('\n'),
      });
    });

    test('match error with optional properties (test 1)', () => {
      const v = validator`{ x?: 2, y?: 2 } | { x?: 3, y?: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.y to be 2 but got 3.',
          '  * Expected <receivedValue>.x to be 3 but got 2.',
        ].join('\n'),
      });
    });

    test('match error with optional properties (test 2)', () => {
      const v = validator`{ x: 2, y: 2 } | { x?: 3, y?: 3 }`;
      const act = (): any => v.assertMatches({ x: 2, y: 3 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.y to be 2 but got 3.',
          '  * Expected <receivedValue>.x to be 3 but got 2.',
        ].join('\n'),
      });
    });

    test('matching parts of all three variants in a three-way union', () => {
      const v = validator`{ x: 2, y: 2, z: 2 } | { x: 3, y: 3, z: 3 } | { x: 4, y: 4, z: 4}`;
      const act = (): any => v.assertMatches({ x: 2, y: 3, z: 4 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.y to be 2 but got 3.',
          '  * Expected <receivedValue>.x to be 3 but got 2.',
          '  * Expected <receivedValue>.x to be 4 but got 2.',
        ].join('\n'),
      });
    });

    test('matching parts of just two variants in a three-way union', () => {
      const v = validator`{ x: 2, y: 2, z: 2 } | { x: 3, y: 3, z: 3 } | { x: 4, y: 4, z: 4}`;
      const act = (): any => v.assertMatches({ x: 2, y: 3, z: 3 });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>.y to be 2 but got 3.',
          '  * Expected <receivedValue>.x to be 3 but got 2.',
          '  * Expected <receivedValue>.x to be 4 but got 2.',
        ].join('\n'),
      });
    });

    test('object matchers includes an index type (test 1)', () => {
      const v = validator`{ x: false, 0: 'A' } | { x: true, [index: number]: 'B' }`;
      const act = (): any => v.assertMatches({ x: false, 0: 'B' });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>["0"] to be "A" but got "B".',
          '  * Expected <receivedValue>.x to be true but got false.',
        ].join('\n'),
      });
    });

    test('object matchers includes multiple index types (test 2)', () => {
      const mySymb = Symbol('test symbol');
      const v = validator`{ [index: symbol]: 'A', 0: 'A' } | { [${mySymb}]: 'B', [index: number]: 'B' }`;
      const act = (): any => v.assertMatches({ [mySymb]: 'A', 0: 'B' });
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>["0"] to be "A" but got "B".',
          '  * Expected <receivedValue>[Symbol(test symbol)] to be "B" but got "A".',
        ].join('\n'),
      });
    });
  });

  test('all union variants have a same required field', () => {
    const v = validator`{ x: number, y: number } | { x: number, z: number }`;
    const act = (): any => v.assertMatches({});
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * <receivedValue> is missing the required properties: "x", "y"',
        '  * <receivedValue> is missing the required properties: "x", "z"',
      ].join('\n'),
    });
  });

  test('matching against two nested objects that do not overlap at the deeper level (test 1)', () => {
    const v = validator`number | { sub: { y: 0 } } | { sub: { z: 0 } }`;
    const act = (): any => v.assertMatches({ sub: { y: 1, z: 1 } });
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>.sub.y to be 0 but got 1.',
        '  * Expected <receivedValue>.sub.z to be 0 but got 1.',
      ].join('\n'),
    });
  });

  test('matching against two nested objects that do not overlap at the deeper level (test 2)', () => {
    const v = validator`number | { sub: { y: 0 } } | { sub: { z: 0 } }`;
    v.assertMatches({ sub: { y: 1, z: 0 } });
  });
});
