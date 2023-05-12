import { strict as assert } from 'node:assert';
import { validator } from '../src';

describe('order of operations', () => {
  test('intersection syntax has a higher precedence than union syntax (test 1)', () => {
    // Parsed as `({ x: number } & { y: number }) | string`
    const v = validator`{ x: number } & { y: number } | string`;
    expect(v.matches('xyz')).toBe(true);
    expect(v.matches({ x: 2, y: 3 })).toBe(true);
    expect(v.matches({ x: 2 })).toBe(false);
    expect(v.matches({ y: 3 })).toBe(false);
  });

  test('intersection syntax has a higher precedence than union syntax (test 2)', () => {
    // Parsed as `string | ({ x: number } & { y: number })`
    const v = validator`string | { x: number } & { y: number }`;
    expect(v.matches('xyz')).toBe(true);
    expect(v.matches({ x: 2, y: 3 })).toBe(true);
    expect(v.matches({ x: 2 })).toBe(false);
    expect(v.matches({ y: 3 })).toBe(false);
  });

  test('intersection syntax has a higher precedence than union syntax (test 3)', () => {
    const v = validator`(string) | ({ x: number }) & ({ y: number })`;
    expect(v.matches('xyz')).toBe(true);
    expect(v.matches({ x: 2, y: 3 })).toBe(true);
    expect(v.matches({ x: 2 })).toBe(false);
    expect(v.matches({ y: 3 })).toBe(false);
  });

  test('array syntax has higher precedence than intersection syntax', () => {
    // Parsed as `({ x: number }[]) & ({ y: number }[])`, not `({ x: number }[] & { y: number })[]`
    const v = validator`{ x: number }[] & { y: number }[]`;
    expect(v.matches([{ x: 2, y: 3 }])).toBe(true);
    expect(v.matches([{ y: 3 }])).toBe(false);
  });

  test('iterable syntax has higher precedence than union syntax', () => {
    // Parsed as `${Set} | (${Array}@<string>), not (${Set} | ${Array})@<string>
    const v = validator`${Set} | ${Array}@<boolean>`;
    expect(v.matches([true])).toBe(true);
    expect(v.matches([2])).toBe(false);
    expect(v.matches(new Set([true]))).toBe(true);
    expect(v.matches(new Set([2]))).toBe(true);
  });

  test('able to put iterable syntax after array syntax', () => {
    const v = validator`{ x: string }[]@<{ y: number }>`;
    expect(v.matches([{ x: 'x', y: 2 }])).toBe(true);
    expect(v.matches([{ x: 'x' }])).toBe(false);
    expect(v.matches([{ y: 2 }])).toBe(false);
  });

  test('able to put array syntax after iterable syntax', () => {
    const v = validator`${Array}@<{ x: string }>[]`;
    expect(v.matches([[{ x: 'x' }]])).toBe(true);
    expect(v.matches([[{ x: 2 }]])).toBe(false);
  });

  test('list of empty tuples', () => {
    const v = validator`[][]`;
    expect(v.matches([[], []])).toBe(true);
    expect(v.matches([[1], []])).toBe(false);
  });
});

describe('unions of different types', () => {
  test('union of tuple and primitive literal (test 1)', () => {
    const v = validator`[2] | 3`;
    v.assertMatches(3);
    v.assertMatches([2]);
  });

  test('union of tuple and primitive literal (test 2)', () => {
    const v = validator`[2] | 3`;
    const act = (): any => v.assertMatches(4);
    assert.throws(act, {
      message: 'Expected <receivedValue> to be 3 but got 4.',
    });
  });

  test('union of tuple and primitive literal (test 3)', () => {
    const v = validator`[2] | 3`;
    const act = (): any => v.assertMatches([4]);
    assert.throws(act, {
      message: 'Expected <receivedValue>[0] to be 2 but got 4.',
    });
  });

  test('union of array and primitive literal (test 1)', () => {
    const v = validator`2[] | 3`;
    v.assertMatches(3);
    v.assertMatches([2, 2]);
  });

  test('union of array and primitive literal (test 2)', () => {
    const v = validator`2[] | 3`;
    const act = (): any => v.assertMatches(4);
    assert.throws(act, {
      message: 'Expected <receivedValue> to be 3 but got 4.',
    });
  });

  test('union of array and primitive literal (test 3)', () => {
    const v = validator`2[] | 3`;
    const act = (): any => v.assertMatches([4]);
    assert.throws(act, {
      message: 'Expected <receivedValue>[0] to be 2 but got 4.',
    });
  });

  test('union of object and primitive literal (test 1)', () => {
    const v = validator`{ x: 2 } | 3`;
    v.assertMatches(3);
    v.assertMatches({ x: 2 });
  });

  test('union of object and primitive literal (test 2)', () => {
    const v = validator`{ x: 2 } | 3`;
    const act = (): any => v.assertMatches(4);
    assert.throws(act, {
      message: 'Expected <receivedValue> to be 3 but got 4.',
    });
  });

  test('union of object and primitive literal (test 3)', () => {
    const v = validator`{ x: 2 } | 3`;
    const act = (): any => v.assertMatches({ x: 4 });
    assert.throws(act, {
      message: 'Expected <receivedValue>.x to be 2 but got 4.',
    });
  });

  test('union of array and tuple', () => {
    const v = validator`2[] | [2, 3]`;
    v.assertMatches([2, 2]);
    v.assertMatches([2, 3]);
    const act = (): any => v.assertMatches([2, 4]);
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * Expected <receivedValue>[1] to be 2 but got 4.',
        '  * Expected <receivedValue>[1] to be 3 but got 4.',
      ].join('\n'),
    });
  });

  test('union of array and object (and primitive literal) (test 1)', () => {
    const v = validator`{ x: 2, y: 3 } | 4[] | 9`;
    v.assertMatches([4]);
    v.assertMatches({ x: 2, y: 3 });
  });

  test('union of array and object (and primitive literal) (test 2)', () => {
    const v = validator`{ x: 2, y: 3 } | 4[] | 9`;
    const act = (): any => v.assertMatches([0]);
    assert.throws(act, {
      message: 'Expected <receivedValue>[0] to be 4 but got 0.',
    });
  });

  test('union of array and object (and primitive literal) (test 3)', () => {
    const v = validator`{ x: 2, y: 3 } | 4[] | 9`;
    const act = (): any => v.assertMatches({ x: 2 });
    assert.throws(act, {
      message: '<receivedValue> is missing the required properties: "y"',
    });
  });

  test('union of array and object (and primitive literal) (test 4)', () => {
    const v = validator`{ x: 2, y: 3 } | 4[] | 9`;
    const act = (): any => v.assertMatches(Object.assign([0], { x: 2 }));
    // TODO: Ideally we would show the object variant error if we detect that the array has extra properties on it,
    // i.e. it's trying to behave like both an array and a normal object. The other reason why we might want to
    // show the object error is if the object pattern has numeric keys.
    // This is mostly an edge case (people usually don't stick properties on objects, or use numeric keys on objects to match array),
    // so it's not that important, but if you do run into the edge case, the current behavior would be fairly annoying.
    assert.throws(act, {
      message: 'Expected <receivedValue>[0] to be 4 but got 0.',
    });
  });

  test('union of tuple and object (and primitive literal) (test 1)', () => {
    const v = validator`{ x: 2, y: 3 } | [4] | 9`;
    v.assertMatches([4]);
    v.assertMatches({ x: 2, y: 3 });
  });

  test('union of tuple and object (and primitive literal) (test 2)', () => {
    const v = validator`{ x: 2, y: 3 } | [4] | 9`;
    const act = (): any => v.assertMatches([0]);
    assert.throws(act, {
      message: 'Expected <receivedValue>[0] to be 4 but got 0.',
    });
  });

  test('union of tuple and object (and primitive literal) (test 3)', () => {
    const v = validator`{ x: 2, y: 3 } | [4] | 9`;
    const act = (): any => v.assertMatches({ x: 2 });
    assert.throws(act, {
      message: '<receivedValue> is missing the required properties: "y"',
    });
  });

  test('union of tuple and object (and primitive literal) (test 4)', () => {
    const v = validator`{ x: 2, y: 3 } | [4] | 9`;
    const act = (): any => v.assertMatches(Object.assign([0, 0], { x: 2 }));
    assert.throws(act, {
      message: [
        'One of the following issues needs to be resolved:',
        '  * <receivedValue> is missing the required properties: "y"',
        '  * Expected the <receivedValue> array to have 1 entry, but found 2.',
      ].join('\n'),
    });
  });

  // With `A & B`, if `A` passed and `B` fails, the "deepness" of the failure will either be the original
  // failure's deepness level, or the maximum possible deepness error of A, whichever is greater.
  describe('intersection chain, where second link fails', () => {
    test('all primitive literals', () => {
      const v = validator`(number & 1) | 2`;
      const act = (): any => v.assertMatches(3);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue> to be 1 but got 3.',
          '  * Expected <receivedValue> to be 2 but got 3.',
        ].join('\n'),
      });
    });

    test('simple and primitive literal patterns', () => {
      const v = validator`(1 & string) | 2`;
      const act = (): any => v.assertMatches(1);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue> to be of type "string" but got type "number".',
          '  * Expected <receivedValue> to be 2 but got 1.',
        ].join('\n'),
      });
    });

    // The highest possible deepness level of the left-hand side of "&" is higher than other union variants,
    // so only the error for the RHS of "&" should show.
    test('higher-deepness matches with interpolation', () => {
      class MyArray extends Array {}
      const v = validator`[1, 2, 3] & ${MyArray} | [1, 2]`;
      const act = (): any => v.assertMatches([1, 2, 3]);
      assert.throws(act, {
        message: (
          'Expected <receivedValue>, which was [object Array], to be an instance of `MyArray` ' +
          '(and not an instance of a subclass).'
        ),
      });
    });

    // The highest possible deepness level of the left-hand side of "&" is equal to other union variants,
    // so errors from the other variants show, instead of the failed RHS of "&".
    test('lower-deepness matches with interpolation', () => {
      const v = validator`number & ${validator`1`} | 2`;
      const act = (): any => v.assertMatches(3);
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue> to be 1 but got 3.',
          '  * Expected <receivedValue> to be 2 but got 3.',
        ].join('\n'),
      });
    });

    test('interpolation (test 1)', () => {
      class MyClass {} // eslint-disable-line @typescript-eslint/no-extraneous-class
      const andExpectEmptyObject = validator.expectTo((x: any) => Object.keys(x).length === 0 ? 'be empty.' : null);
      const v = validator`${andExpectEmptyObject} & ${MyClass} | { x: 2 }`;
      const act = (): any => v.assertMatches({});
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>, which was [object Object], to be empty.',
          '  * <receivedValue> is missing the required properties: "x"',
        ].join('\n'),
      });
    });

    test('interpolation (test 2)', () => {
      class MyClass {} // eslint-disable-line @typescript-eslint/no-extraneous-class
      const expectObject = validator.expectTo((x: any) => Object(x) === x ? null : 'be an object.');
      const v = validator`${expectObject} & ${MyClass} | number`;
      const act = (): any => v.assertMatches({});
      assert.throws(act, {
        message: [
          'One of the following issues needs to be resolved:',
          '  * Expected <receivedValue>, which was [object Object], to be an instance of `MyClass` (and not an instance of a subclass).',
          '  * Expected <receivedValue> to be of type "number" but got type "object".',
        ].join('\n'),
      });
    });

    // TODO: Writes tests for a three-long intersection chain
  });
});
