import { strict as assert } from 'node:assert';
import { Validator, validator } from '../src';

const createValidator = (content: string): Validator => validator({ raw: [content] });

const createInterpolatedValidator = (valuesToInterpolate: unknown[], content: string): Validator => {
  return validator({
    raw: content.split('<INTERPOLATE>'),
  }, ...valuesToInterpolate);
};

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

  test('handles underline sprawling over multiple lines', () => {
    const act = (): any => createValidator([
      '[number?, {',
      '  x: number',
      '}]',
    ].join('\n'));

    assert.throws(act, {
      message: [
        'Required entries can not appear after optional entries. (line 1, col 11)',
        '  [number?, {\\n  x: number\\n}]',
        '            ~~~~~~~~~~~~~~~~~',
      ].join('\n'),
    });
  });

  test('handles underlining interpolation point (test 1)', () => {
    const act = (): any => validator`(string ${42} number)`;
    assert.throws(act, {
      message: [
        'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
        '  (string ${…} number)',
        '          ~~~~',
      ].join('\n'),
    });
  });

  test('handles underlining interpolation point (test 2)', () => {
    const act = (): any => validator`[number?, [string, ${2}, boolean]]`;
    assert.throws(act, {
      message: [
        'Required entries can not appear after optional entries. (line 1, col 11)',
        '  [number?, [string, ${…}, boolean]]',
        '            ~~~~~~~~~~~~~~~~~~~~~~~',
      ].join('\n'),
    });
  });

  test('correctly positions underline after an interpolation point', () => {
    const act = (): any => validator`(${42} number)`;
    assert.throws(act, {
      message: [
        'Expected to find a closing parentheses (`)`) here. (line 1, col 3)',
        '  (${…} number)',
        '        ~~~~~~',
      ].join('\n'),
    });
  });

  test('handles underline sprawling over multiple lines with interpolation points', () => {
    const valuesToInterpolate = [2, 3, 4, 5];
    const act = (): any => createInterpolatedValidator(valuesToInterpolate, [
      '(',
      '  [<INTERPOLATE>?, { w: <INTERPOLATE>,',
      '    x: <INTERPOLATE>',
      '  }, <INTERPOLATE>?]',
      ')',
    ].join('\n'));

    assert.throws(act, {
      message: [
        'Required entries can not appear after optional entries. (line 2, col 7)',
        '  [${…}?, { w: ${…},' + '\\' + 'n    x: ${…}' + '\\' + 'n  }, ${…}?]',
        '          ~~~~~~~~~~' + '~'  + '~~~~~~~~~~~~' + '~'  + '~~~~', // eslint-disable-line no-multi-spaces
      ].join('\n'),
    });
  });

  describe('truncates long lines', () => {
    test('long lines with a centered underline are truncated on both sides', () => {
      const act = (): any => createInterpolatedValidator([1, 2, 3, 4], [
        '(',
        (
          '(<INTERPOLATE> | "1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" | <INTERPOLATE>) ' +
          'string ' +
          '(<INTERPOLATE> | "1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" | <INTERPOLATE>)'
        ),
        ')',
      ].join('\n'));

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 2, col 76)',
          '  …FGHIJKLMNOPQRSTUVWXYZ" | ${…}) string (${…} | "1234567890 abcdefghij…',
          '                                  ~~~~~~',
        ].join('\n'),
      });
    });

    test('it can do a right-side only truncate if needed', () => {
      const act = (): any => createInterpolatedValidator(
        [1, 2],
        `(<INTERPOLATE> string <INTERPOLATE> "1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ${'x'.repeat(20)}")`,
      );

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 3)',
          '  (${…} string ${…} "1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKL…',
          '        ~~~~~~',
        ].join('\n'),
      });
    });

    test('it can do a left-side only truncate if needed', () => {
      const act = (): any => createValidator(
        `("${'x'.repeat(20)} abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890" number string)`,
      );

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 90)',
          '  …lmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890" number string)',
          '                                                          ~~~~~~',
        ].join('\n'),
      });
    });

    test('it prefers to not truncate the left if it can help it', () => {
      const act = (): any => createValidator(
        '("abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" string "ABCDEFGHIJKLMNOPQRSTUVWXYZ")',
      );

      // While it could have centered this and truncated both sides,
      // it preferred to keep it left-aligned, since it was possible to do
      // while still fitting in the underlined section.
      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 58)',
          '  ("abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" string "ABCD…',
          '                                                           ~~~~~~',
        ].join('\n'),
      });
    });

    test('it avoids splitting up "${…}" when truncating', () => {
      const act = (repeatedPortionLength: number): any => createInterpolatedValidator(
        [1],
        `(2 3 "${'x'.repeat(repeatedPortionLength)}" <INTERPOLATE> xxxxxxxxxx)`,
      );

      assert.throws(() => act(57), {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 4)',
          '  (2 3 "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ${…}…',
          '     ~',
        ].join('\n'),
      });

      // We only add one more "x", but what gets truncated moves across the entire "${…}"
      assert.throws(() => act(58), {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 4)',
          '  (2 3 "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" …',
          '     ~',
        ].join('\n'),
      });
    });

    test('it avoids splitting up "\\n" when truncating', () => {
      const act = (repeatedPortionLength: number): any => createInterpolatedValidator(
        [1],
        `(2 "${'x'.repeat(40)}\n${'x'.repeat(repeatedPortionLength)}")`,
      );

      assert.throws(() => act(17), {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 4)',
          '  (2 "xxxxxxxxxxxxxxxxxx…' + '\\' + 'nxxxxxxxxxxxxxxxxx")',
          '     ~~~~~~~~~~~~~~~~~~~~' + '~' +  '~~~~~~~~~~~~~~~~~~~', // eslint-disable-line no-multi-spaces
        ].join('\n'),
      });

      // We only add one more "x", but what gets truncated moves across the entire "\n"
      assert.throws(() => act(18), {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 4)',
          '  (2 "xxxxxxxxxxxxxxxxxxx…xxxxxxxxxxxxxxxxxx")',
          '     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });
  });

  describe('truncating long lines with long underlined portions', () => {
    test('the underlined portion is long, and nothing else', () => {
      const act = (): any => createValidator(
        '(number "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890" string)',
      );

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
          '  (number "abcdefghijklmnopqr…STUVWXYZ 1234567890" string)',
          '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });

    test('the underlined portion is long and has new lines', () => {
      const act = (): any => createValidator(
        '(number "abcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZ\n1234567890" string)',
      );

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
          '  (number "abcdefghijklmnopqr…TUVWXYZ' + '\\' + 'n1234567890" string)',
          '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~' + '~'  + '~~~~~~~~~~~~', // eslint-disable-line no-multi-spaces
        ].join('\n'),
      });
    });

    test('the underlined portion is long and has interpolation points', () => {
      const act = (): any => createInterpolatedValidator(
        [1, 2, 3],
        '[<INTERPOLATE>?, ("abcdefghijklmnopqrstuvwxyz" | <INTERPOLATE> | "ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890"), <INTERPOLATE>]',
      );

      assert.throws(act, {
        message: [
          'Required entries can not appear after optional entries. (line 1, col 5)',
          '  [${…}?, ("abcdefghijklmnopq…TUVWXYZ 1234567890"), ${…}]',
          '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });

    test('long lines with a centered underline are truncated on both sides', () => {
      const act = (): any => createValidator([
        '(' +
        '"1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" ' +
        '"1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" ' +
        '"1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ"' +
        ')',
      ].join('\n'));

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 69)',
          '  …OPQRSTUVWXYZ" "1234567890 abcdefg…HIJKLMNOPQRSTUVWXYZ" "1234567890 a…',
          '                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });

    test('it can do a right-side only truncate if needed', () => {
      const act = (): any => createValidator(
        '(' +
        'number ' +
        '"1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ" ' +
        '"1234567890 abcdefghijklmnopqrstuvwxyz"' +
        ')',
      );

      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
          '  (number "1234567890 abcdefg…HIJKLMNOPQRSTUVWXYZ" "1234567890 abcdefgh…',
          '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });

    test('it prefers to not truncate the left if it can help it', () => {
      const act = (): any => createValidator(
        '(' +
        '"1234567890 1234567890" ' +
        '"abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890" ' +
        '"ABCDEFGHIJKLMNOPQRSTUVWXYZ")',
      );

      // While it could have centered this and truncated both sides,
      // it preferred to keep it left-aligned, since it was possible to do
      // while still fitting in the underlined section.
      assert.throws(act, {
        message: [
          'Expected to find a closing parentheses (`)`) here. (line 1, col 26)',
          '  ("1234567890 1234567890" "abcdefghijklmnopqr…STUVWXYZ 1234567890" "AB…',
          '                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        ].join('\n'),
      });
    });
  });
});
