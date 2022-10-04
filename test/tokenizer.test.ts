import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('tokenizer', () => {
  test('throws an error when EOF is expected but more content is found', () => {
    const act = (): any => validator`string xyz`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Expected EOF. (line 1, col 8)',
        '  string xyz',
        '         ~~~',
      ].join('\n'),
    });
  });

  test('throws on an invalid token', () => {
    const act = (): any => validator`string | #@xy! !! X`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Failed to interpret this syntax. (line 1, col 10)',
        '  string | #@xy! !! X',
        '           ~~~~~',
      ].join('\n'),
    });
  });

  test('throws on an invalid token at the end of the input', () => {
    const act = (): any => validator`string | #@xy!X`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Failed to interpret this syntax. (line 1, col 10)',
        '  string | #@xy!X',
        '           ~~~~~~',
      ].join('\n'),
    });
  });

  test('throws on an empty string input', () => {
    const act = (): any => validator``;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, { message: 'The validator had no content.' });
  });

  test('throws on whitespace-only input', () => {
    const act = (): any => validator({ raw: [' \t\n'] });
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, { message: 'The validator had no content.' });
  });
});
