import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

// These are not meant to be comprehensive tests, rather,
// they're simple smoke tests to make sure the validation checks
// aren't completely busted.
describe('user input validation for validator API', () => {
  test('validator template tag', () => {
    const act = (): any => validator(42 as any);
    assert.throws(act, { message: 'Expected <receivedValue>[0] to be an object but got 42.' });
    assert.throws(act, ValidatorAssertionError);
  });
});
