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

  test('list of empty tuples', () => {
    const v = validator`[][]`;
    expect(v.matches([[], []])).toBe(true);
    expect(v.matches([[1], []])).toBe(false);
  });
});
