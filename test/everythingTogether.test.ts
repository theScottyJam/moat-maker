import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError } from '../src';

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
