import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError } from '../src';

describe('order of operations', () => {
  test('array syntax has higher precedence than union syntax', () => {
    // Parsed as `(string[]) | (number[]), not (string[] | number)[]
    const v = validator`string[] | number[]`;
    expect(v.matches(['xyz'])).toBe(true);
    expect(v.matches([2])).toBe(true);
    expect(v.matches([['xyz']])).toBe(false);
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
