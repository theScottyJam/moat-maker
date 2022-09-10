import { helloWorld } from '../src';

describe('helloWorld()', () => {
  test('helloWorld() is a function', () => {
    expect(helloWorld).toBeInstanceOf(Function);
  });
});
