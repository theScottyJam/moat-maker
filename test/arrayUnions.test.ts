import { strict as assert } from 'node:assert';
import { validator } from '../src';

describe('union rules with arrays', () => {
  test('fails to match both union variants (test 1)', () => {
    const v = validator`number[] | string[]`;
    const act = (): any => v.assertMatches([true]);
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>[0] to be of type "number" but got type "boolean".',
        '  * Expected <receivedValue>[0] to be of type "string" but got type "boolean".',
      ].join('\n'),
    });
  });

  describe('array entries are a union', () => {
    test('given a valid input, the simple case does not throw', () => {
      const v = validator`(0 | 1)[]`;
      v.assertMatches([0]);
    });

    test('given an invalid input, the simple case properly throws', () => {
      const v = validator`(0 | 1)[]`;
      const act = (): any => v.assertMatches([2]);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>[0] to be 0 but got 2.',
          '  * Expected <receivedValue>[0] to be 1 but got 2.',
        ].join('\n'),
      });
    });

    test('having nested and outer unions correctly allows valid input (test 1)', () => {
      const v = validator`(0 | 1)[] | 2[]`;
      v.assertMatches([0]);
    });

    test('having nested and outer unions correctly allows valid input (test 2)', () => {
      const v = validator`(0 | 1)[] | 2[]`;
      v.assertMatches([2]);
    });

    test('having nested and outer unions correctly throws with invalid input', () => {
      const v = validator`(0 | 1)[] | 2[]`;
      const act = (): any => v.assertMatches([3]);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>[0] to be 0 but got 3.',
          '  * Expected <receivedValue>[0] to be 1 but got 3.',
          '  * Expected <receivedValue>[0] to be 2 but got 3.',
        ].join('\n'),
      });
    });
  });

  describe('ignores variants that are likely irrelevant', () => {
    test('if the input value is of type array, primitive sibling rule errors are ignored', () => {
      const v = validator`number | 2[] | 3[]`;
      const act = (): any => v.assertMatches([0]);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>[0] to be 2 but got 0.',
          '  * Expected <receivedValue>[0] to be 3 but got 0.',
        ].join('\n'),
      });
    });

    // In addition to ignoring errors from sibling rules with invalid lengths,
    // only the errors related to the right-most failed entry in the array are shown.
    test('earlier array entry failures are ignored, in favor of only showing errors for later entries', () => {
      const v = validator`1[] | 2[]`;
      const act = (): any => v.assertMatches([1, 2]);
      assert.throws(act, {
        message: 'Expected <receivedValue>[1] to be 1 but got 2.',
      });
    });

    test('does not throw a union-style error if there is only one non-ignored union variant', () => {
      const v = validator`number | 2[]`;
      const act = (): any => v.assertMatches([0]);
      assert.throws(act, {
        message: 'Expected <receivedValue>[0] to be 2 but got 0.',
      });
    });
  });
});
