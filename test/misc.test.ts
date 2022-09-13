/* eslint-disable no-new-wrappers */

import { validator } from '../src';

describe('validator behavior', () => {
  test('It returns a frozen object', () => {
    const v = validator`string`;
    expect(Object.isFrozen(v)).toBe(true);
  });

  test('matches() returns true if the provided value is valid', () => {
    const v = validator`string`;
    expect(v.matches('xyz')).toBe(true);
  });

  test('matches() returns false if the provided value is invalid', () => {
    const v = validator`string`;
    expect(v.matches(2)).toBe(false);
  });

  test('assertMatches() returns the argument', () => {
    const v = validator`string`;
    expect(v.assertMatches('xyz')).toBe('xyz');
  });
});
