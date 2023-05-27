import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src/index.js';

describe('generic syntax', () => {
  test('Allows ${...} to be tested against', () => {
    const v = validator`"\${42}"`;
    expect(v.matches('${42}')).toBe(true);
  });

  test('throws an error when EOF is expected but more content is found', () => {
    const act = (): any => validator`string xyz`;
    assert.throws(act, {
      message: [
        'Expected EOF. (line 1, col 8)',
        '  string xyz',
        '         ~~~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws on an invalid token', () => {
    const act = (): any => validator`string | #@xy! !! X`;
    assert.throws(act, {
      message: [
        'Failed to interpret this syntax. (line 1, col 10)',
        '  string | #@xy! !! X',
        '           ~~~~~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws on an invalid token at the end of the input', () => {
    const act = (): any => validator`string | #@xy!X`;
    assert.throws(act, {
      message: [
        'Failed to interpret this syntax. (line 1, col 10)',
        '  string | #@xy!X',
        '           ~~~~~~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws on an empty string input', () => {
    const act = (): any => validator``;
    assert.throws(act, { message: 'The validator had no content.' });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws on whitespace-only input', () => {
    const act = (): any => validator(Object.assign([], { raw: [' \t\n'] }) as any);
    assert.throws(act, { message: 'The validator had no content.' });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws when an unexpected token is found where a type is expected', () => {
    const act = (): any => validator`string | @`;
    assert.throws(act, {
      message: [
        'Expected to find a type here. (line 1, col 10)',
        '  string | @',
        '           ~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });

  test('throws when an invalid identifier is found where a type is expected', () => {
    const act = (): any => validator`string | TRUE`;
    assert.throws(act, {
      message: [
        'Expected to find a type here. (line 1, col 10)',
        '  string | TRUE',
        '           ~~~~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
