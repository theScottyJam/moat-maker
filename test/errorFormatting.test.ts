import { strict as assert } from 'node:assert';
import { Validator, validator } from '../src';

const createValidator = (content: string): Validator => validator({ raw: [content] });

describe('error formatting', () => {
  test('handles underlining multi-line errors', () => {
    const act = (): any => createValidator([
      '(',
      '      string | ###   ',
      ')',
    ].join('\n'));

    assert.throws(act, {
      message: [
        'Failed to interpret this syntax. (line 2, col 16)',
        '  string | ###',
        '           ~~~',
      ].join('\n'),
    });
  });

  xtest('handles underline sprawling over multiple lines', () => {
    const act = (): any => createValidator([
      '[number?, {',
      '  x: number',
      '}]',
    ].join('\n'));

    assert.throws(act, {
      message: [
        'Required entries can not appear after optional entries. (line 1, col 11)',
        '  [number?, {\n  x: number\n}]',
        '            ~~~~~~~~~~~~~~~~~',
      ].join('\n'),
    });
  });
});
