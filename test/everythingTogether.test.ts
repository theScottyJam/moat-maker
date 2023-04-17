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

  test('iterator syntax has higher precedence than union syntax', () => {
    // Parsed as `${Set} | (${Array}@<string>), not (${Set} | ${Array})@<string>
    const v = validator`${Set} | ${Array}@<boolean>`;
    expect(v.matches([true])).toBe(true);
    expect(v.matches([2])).toBe(false);
    expect(v.matches(new Set([true]))).toBe(true);
    expect(v.matches(new Set([2]))).toBe(true);
  });

  test('able to put iterator syntax after array syntax', () => {
    const v = validator`{ x: string }[]@<{ y: number }>`;
    expect(v.matches([{ x: 'x', y: 2 }])).toBe(true);
    expect(v.matches([{ x: 'x' }])).toBe(false);
    expect(v.matches([{ y: 2 }])).toBe(false);
  });

  test('able to put array syntax after iterator syntax', () => {
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
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue> to be 3 but got 4.',
        '  Variant 2: Expected <receivedValue> to be an array but got 4.',
      ].join('\n'),
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
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue> to be 3 but got 4.',
        '  Variant 2: Expected <receivedValue> to be an array but got 4.',
      ].join('\n'),
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
      message: [
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue> to be 3 but got 4.',
        '  Variant 2: Expected <receivedValue> to be an object but got 4.',
      ].join('\n'),
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
        'Failed to match against any variant of a union.',
        '  Variant 1: Expected <receivedValue>[1] to be 2 but got 4.',
        '  Variant 2: Expected <receivedValue>[1] to be 3 but got 4.',
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
    // TODO: Not an ideal error. Ideally, we'd only show the error involving the object.
    assert.throws(act, {
      message: '<receivedValue> is missing the required properties: "y"',
    });
  });

  test('union of array and object (and primitive literal) (test 4)', () => {
    const v = validator`{ x: 2, y: 3 } | 4[] | 9`;
    const act = (): any => v.assertMatches(Object.assign([0], { x: 2 }));
    // TODO: Not an ideal error. Ideally, we would show the object error.
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
        'Failed to match against any variant of a union.',
        '  Variant 1: <receivedValue> is missing the required properties: "y"',
        '  Variant 2: Expected the <receivedValue> array to have 1 entry, but found 2.',
      ].join('\n'),
    });
  });
});
