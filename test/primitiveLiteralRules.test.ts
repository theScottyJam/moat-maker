/* eslint-disable no-new-wrappers */

import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError, type Validator } from '../src/index.js';

const createValidator = (content: string): Validator => validator(
  Object.assign([], { raw: [content] }) as any,
);

describe('primitive literal rules', () => {
  describe('boolean', () => {
    test('accepts equivalent boolean inputs', () => {
      const v = validator`true`;
      v.assertMatches(true);
    });

    test('rejects incorrect boolean', () => {
      const v = validator`false`;
      const act = (): any => v.assertMatches(true);
      assert.throws(act, { message: 'Expected <receivedValue> to be false but got true.' });
      assert.throws(act, TypeError);
    });

    test('rejects strings', () => {
      const v = validator`true`;
      const act = (): any => v.assertMatches('true');
      assert.throws(act, { message: 'Expected <receivedValue> to be true but got "true".' });
      assert.throws(act, TypeError);
    });

    test('rejects boolean objects', () => {
      const v = validator`true`;
      const act = (): any => v.assertMatches(new Boolean(false));
      assert.throws(act, { message: 'Expected <receivedValue> to be true but got [object Boolean].' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`true`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'primitiveLiteral',
          value: true,
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });
  });

  describe('bigint', () => {
    test('accepts equivalent bigint inputs', () => {
      const v = validator`2n`;
      v.assertMatches(2n);
    });

    test('rejects incorrect bigints', () => {
      const v = validator`2n`;
      const act = (): any => v.assertMatches(3n);
      assert.throws(act, { message: 'Expected <receivedValue> to be 2n but got 3n.' });
      assert.throws(act, TypeError);
    });

    test('rejects non-bigint numbers', () => {
      const v = validator`2n`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, { message: 'Expected <receivedValue> to be 2n but got 2.' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`42n`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'primitiveLiteral',
          value: 42n,
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });

    describe('syntax', () => {
      test('Only allows a lowercase n as a bigint suffix', () => {
        const act = (): any => validator`2N`;
        assert.throws(act, {
          message: [
            'Expected EOF. (line 1, col 2)',
            '  2N',
            '   ~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
      });
    });
  });

  describe('string', () => {
    test('accepts equivalent string inputs', () => {
      const v = validator`'xyz'`;
      v.assertMatches('xyz');
    });

    test('rejects incorrect strings', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.assertMatches('xy');
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got "xy".' });
      assert.throws(act, TypeError);
    });

    test('truncates strings in error messages that are too long', () => {
      const v = validator`'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`;
      const act = (): any => v.assertMatches('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789X');
      assert.throws(act, {
        message: (
          'Expected <receivedValue> to be "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX…" ' +
          'but got "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX…".'
        ),
      });
      assert.throws(act, TypeError);
    });

    test('does not truncate the string in the error message if truncating would only remove save a few characters', () => {
      const v = validator`'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'`;
      const act = (): any => v.assertMatches('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYz');
      assert.throws(act, {
        message: (
          'Expected <receivedValue> to be "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" ' +
          'but got "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYz".'
        ),
      });
      assert.throws(act, TypeError);
    });

    test('rejects numeric inputs', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.assertMatches(2);
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got 2.' });
      assert.throws(act, TypeError);
    });

    test('rejects string objects', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.assertMatches(new String('xyz'));
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got [object String].' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`'xyz'`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'primitiveLiteral',
          value: 'xyz',
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });

    describe('syntax', () => {
      test('handles empty strings', () => {
        const v = validator`''`;
        expect(v.matches('')).toBe(true);
        expect(v.matches(' ')).toBe(false);
      });

      test('handles special characters', () => {
        const v = validator`'\0 \\ \n \r \v \t \b \f'`;
        expect(v.matches('\0 \\ \n \r \v \t \b \f')).toBe(true);
        expect(v.matches('\\ \n \r \v \t \b \f')).toBe(false);
      });

      test('does not do special handling for unrecognized special characters', () => {
        const v = validator`'\Z \- \1'`;
        expect(v.matches('Z - 1')).toBe(true);
        expect(v.matches('\\Z \\- \\1')).toBe(false);
      });

      test('able to escape quotes in a single-quoted string', () => {
        const v = validator`'a\'b\"c"d\`e'`;
        expect(v.matches('a\'b"c"d`e')).toBe(true);
      });

      test('able to escape quotes in a double-quoted string', () => {
        const v = validator`"a\"b\'c'd\`e"`;
        expect(v.matches('a"b\'c\'d`e')).toBe(true);
      });

      describe('unicode escaping', () => {
        test('handles unicode character escapes (test 1)', () => {
          const v = validator`'\u003d \u{3d} \x3d'`;
          expect(v.matches('= = =')).toBe(true);
          expect(v.matches('= = @')).toBe(false);
        });

        test('handles unicode character escapes (test 2)', () => {
          const v = validator`'\u{1F303} \uD83C\uDF03'`;
          expect(v.matches('🌃 🌃')).toBe(true);
          expect(v.matches('🌃 x')).toBe(false);
        });

        test('handles unicode character escapes with uppercase characters', () => {
          const v = validator`'\u003D \u{3D} \x3D'`;
          expect(v.matches('= = =')).toBe(true);
          expect(v.matches('= = @')).toBe(false);
        });

        test('\\x must have exactly two characters afterwards (test 1)', () => {
          const act = (): any => createValidator('"\\x9"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly two hexadecimal digits to follow the "\\x". (line 1, col 2)',
              '  "' + '\\' + 'x9"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\x must have exactly two characters afterwards (test 2)', () => {
          const act = (): any => createValidator('"\\x"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly two hexadecimal digits to follow the "\\x". (line 1, col 2)',
              '  "' + '\\' + 'x"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u must have exactly four characters afterwards (test 1)', () => {
          const act = (): any => createValidator('"\\u9"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly four hexadecimal digits to follow the "\\u". (line 1, col 2)',
              '  "' + '\\' + 'u9"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u must have exactly four characters afterwards (test 2)', () => {
          const act = (): any => createValidator('"\\u"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly four hexadecimal digits to follow the "\\u". (line 1, col 2)',
              '  "' + '\\' + 'u"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u{...} must contain no more than 6 characters', () => {
          const act = (): any => createValidator('"\\u{1234567}"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly six hexadecimal digits between "\\u{" and "}". (line 1, col 2)',
              '  "' + '\\' + 'u{1234567}"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u{...} must be formatted properly (test 1)', () => {
          const act = (): any => createValidator('"\\u{123456"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly six hexadecimal digits between "\\u{" and "}". (line 1, col 2)',
              '  "' + '\\' + 'u{123456"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u{...} must be formatted properly (test 2)', () => {
          const act = (): any => createValidator('"\\u{g}"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly six hexadecimal digits between "\\u{" and "}". (line 1, col 2)',
              '  "' + '\\' + 'u{g}"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u{...} must be formatted properly (test 3)', () => {
          const act = (): any => createValidator('"\\u{"');
          assert.throws(act, {
            message: [
              'Invalid unicode escape sequence: Expected exactly six hexadecimal digits between "\\u{" and "}". (line 1, col 2)',
              '  "' + '\\' + 'u{"',
              '   ' + '~'  + '~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('\\u{...} can not contain invalid code points', () => {
          const act = (): any => createValidator('"\\u{123456}"');
          assert.throws(act, {
            message: [
              'Invalid code point "0x123456". (line 1, col 2)',
              '  "' + '\\' + 'u{123456}"',
              '   ' + '~'  + '~~~~~~~~~', // eslint-disable-line no-multi-spaces
            ].join('\n'),
          });
          assert.throws(act, ValidatorSyntaxError);
        });

        test('An uppercase \\U and \\X does not trigger a unicode escape sequence', () => {
          const v = validator`'\U\X'`;
          expect(v.matches('UX')).toBe(true);
        });
      });

      test('encounter EOF before closing quote', () => {
        const act = (): any => validator`'xyz`;
        assert.throws(act, {
          message: [
            'Expected to find a quote to end the string literal. (line 1, col 1)',
            "  'xyz",
            '  ~~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
      });

      test('encounter EOF after backslash before closing quote', () => {
        const act = (): any => createValidator('"xyz\\');
        assert.throws(act, {
          message: [
            'Expected to find a quote to end the string literal. (line 1, col 1)',
            '  "xyz\\',
            '  ~~~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
      });

      test('encounter interpolation point before closing quote', () => {
        const act = (): any => validator`'xyz${42}abc'`;
        assert.throws(act, {
          message: [
            'Expected to find a quote to end the string literal. (line 1, col 1)',
            "  'xyz${…}abc'",
            '  ~~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
      });
    });
  });

  describe('number', () => {
    test('accepts equivalent numeric inputs', () => {
      const v = validator`2`;
      v.assertMatches(2);
    });

    test('rejects incorrect numbers', () => {
      const v = validator`2`;
      const act = (): any => v.assertMatches(3);
      assert.throws(act, { message: 'Expected <receivedValue> to be 2 but got 3.' });
      assert.throws(act, TypeError);
    });

    test('rejects string inputs', () => {
      const v = validator`2`;
      const act = (): any => v.assertMatches('xyz');
      assert.throws(act, { message: 'Expected <receivedValue> to be 2 but got "xyz".' });
      assert.throws(act, TypeError);
    });

    test('rejects number objects', () => {
      const v = validator`2`;
      const act = (): any => v.assertMatches(new Number(2));
      assert.throws(act, { message: 'Expected <receivedValue> to be 2 but got [object Number].' });
      assert.throws(act, TypeError);
    });

    test('produces the correct rule', () => {
      const v = validator`2`;
      expect(v.ruleset).toMatchObject({
        rootRule: {
          category: 'primitiveLiteral',
          value: 2,
        },
        interpolated: [],
      });
      expect(Object.isFrozen(v.ruleset)).toBe(true);
      expect(Object.isFrozen(v.ruleset.rootRule)).toBe(true);
      expect(Object.isFrozen(v.ruleset.interpolated)).toBe(true);
    });

    test('-0 matches 0', () => {
      const v = validator`-0`;
      expect(v.matches(0)).toBe(true);
      expect(v.matches(-0)).toBe(true);
    });

    describe('syntax', () => {
      test('handles negative numbers', () => {
        const v = createValidator('- \t\n2');
        expect(v.matches(-2)).toBe(true);
        expect(validator`-23_45`.matches(-2345)).toBe(true);
        assert.throws((): any => validator`-_2345`, ValidatorSyntaxError);
        assert.throws((): any => validator`-2345_`, ValidatorSyntaxError);
      });

      test('ignores positive sign', () => {
        const v = createValidator('+ \t\n2');
        expect(v.matches(2)).toBe(true);
        expect(validator`+23_45`.matches(2345)).toBe(true);
        assert.throws((): any => validator`+_2345`, ValidatorSyntaxError);
        assert.throws((): any => validator`+2345_`, ValidatorSyntaxError);
      });

      test('handles decimals', () => {
        const v = validator`0.12`;
        expect(v.matches(0.12)).toBe(true);
        expect(v.matches(0.13)).toBe(false);

        expect(validator`+0.12`.matches(0.12)).toBe(true);
        expect(validator`-0.12`.matches(-0.12)).toBe(true);
        expect(validator`0.1_2`.matches(0.12)).toBe(true);
        expect(validator`1_2.34`.matches(12.34)).toBe(true);
        assert.throws((): any => validator`_12.34`, ValidatorSyntaxError);
        assert.throws((): any => validator`12_.34`, ValidatorSyntaxError);
        assert.throws((): any => validator`12._34`, ValidatorSyntaxError);
        assert.throws((): any => validator`12.34_`, ValidatorSyntaxError);
      });

      test('handles decimals without leading zero', () => {
        const v = validator`.12`;
        expect(v.matches(0.12)).toBe(true);
        expect(v.matches(0.13)).toBe(false);

        expect(validator`+.12`.matches(0.12)).toBe(true);
        expect(validator`-.12`.matches(-0.12)).toBe(true);
        assert.throws((): any => validator`._34`, ValidatorSyntaxError);
        assert.throws((): any => validator`.34_`, ValidatorSyntaxError);
      });

      test('looses precision as normal for long decimals', () => {
        const v = validator`0.12000000000000000000000000001`;
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        expect(v.matches(0.12000000000000000000000000001)).toBe(true);
        expect(v.matches(0.12)).toBe(true);
        expect(v.matches(0.13)).toBe(false);
      });

      test('scientific notation', () => {
        expect(validator`2e3`.matches(2e3)).toBe(true);
        expect(validator`2E3`.matches(2e3)).toBe(true);
        expect(validator`+2e3`.matches(2e3)).toBe(true);
        expect(validator`- 2e3`.matches(-2e3)).toBe(true);
        expect(validator`2.4e3`.matches(2.4e3)).toBe(true);
        expect(validator`+2.4e3`.matches(+2.4e3)).toBe(true);
        expect(validator`-2.4e3`.matches(-2.4e3)).toBe(true);
        expect(validator`2.4e1_0`.matches(2.4e10)).toBe(true);
        assert.throws((): any => validator`2.4_e3`, ValidatorSyntaxError);
        assert.throws((): any => validator`2.4e_3`, ValidatorSyntaxError);
        assert.throws((): any => validator`2.4e3_`, ValidatorSyntaxError);
      });

      test('hexadecimal', () => {
        expect(validator`0x2ef`.matches(0x2ef)).toBe(true);
        expect(validator`0X2F`.matches(0x2f)).toBe(true);
        expect(validator`+ 0x2f`.matches(0x2f)).toBe(true);
        expect(validator`- 0x2f`.matches(-0x2f)).toBe(true);
        expect(validator`0x2_f`.matches(0x2f)).toBe(true);
        assert.throws((): any => validator`0x_2f`, ValidatorSyntaxError);
        assert.throws((): any => validator`0x2f_`, ValidatorSyntaxError);
        assert.throws((): any => validator`0_x2f`, ValidatorSyntaxError);
        assert.throws((): any => validator`_0x2f`, ValidatorSyntaxError);
        assert.throws((): any => validator`_0x2f.3`, ValidatorSyntaxError);
      });

      test('binary', () => {
        expect(validator`0b1011`.matches(0b1011)).toBe(true);
        expect(validator`0B1011`.matches(0b1011)).toBe(true);
        expect(validator`+ 0b1011`.matches(0b1011)).toBe(true);
        expect(validator`- 0b1011`.matches(-0b1011)).toBe(true);
        expect(validator`0b10_11`.matches(0b1011)).toBe(true);
        assert.throws((): any => validator`0b_1011`, ValidatorSyntaxError);
        assert.throws((): any => validator`0b1011_`, ValidatorSyntaxError);
        assert.throws((): any => validator`0_b1011`, ValidatorSyntaxError);
        assert.throws((): any => validator`_0b1011`, ValidatorSyntaxError);
        assert.throws((): any => validator`0b1011e1`, ValidatorSyntaxError);
        assert.throws((): any => validator`0b1011.1`, ValidatorSyntaxError);
      });

      test('octal', () => {
        expect(validator`0o167`.matches(0o167)).toBe(true);
        expect(validator`0O167`.matches(0o167)).toBe(true);
        expect(validator`+ 0o167`.matches(0o167)).toBe(true);
        expect(validator`- 0o167`.matches(-0o167)).toBe(true);
        expect(validator`0o1_67`.matches(0o1_67)).toBe(true);
        assert.throws((): any => validator`0o_167`, ValidatorSyntaxError);
        assert.throws((): any => validator`0o167_`, ValidatorSyntaxError);
        assert.throws((): any => validator`0_o167`, ValidatorSyntaxError);
        assert.throws((): any => validator`_0o167`, ValidatorSyntaxError);
        assert.throws((): any => validator`0o167e2`, ValidatorSyntaxError);
        assert.throws((): any => validator`0o167.2`, ValidatorSyntaxError);
      });

      test('infinity', () => {
        expect(validator`Infinity`.matches(Infinity)).toBe(true);
        expect(validator`+Infinity`.matches(Infinity)).toBe(true);
        expect(validator`- Infinity`.matches(-Infinity)).toBe(true);
      });

      test('overly large number', () => {
        const v = validator`1234567890123456789012345678901234567890`;
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        expect(v.matches(1234567890123456789012345678901234567890)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        expect(v.matches(1234567890123456789012345678901234567000)).toBe(true);
      });

      test('numbers with leading zero that contain non-base-8 digits are interpreted in base-10', () => {
        expect(validator`0182`.matches(182)).toBe(true);
        expect(validator`00182`.matches(182)).toBe(true);
        expect(validator`+0182`.matches(182)).toBe(true);
        expect(validator`-0182`.matches(-182)).toBe(true);
        expect(validator`01_82`.matches(182)).toBe(true);
        expect(validator`0_182`.matches(182)).toBe(true);
        expect(validator`00_182`.matches(182)).toBe(true);
        assert.throws((): any => validator`0182_`, ValidatorSyntaxError);
        assert.throws((): any => validator`_0182`, ValidatorSyntaxError);
        assert.throws((): any => validator`0182e2`, ValidatorSyntaxError);
        // This case got its own error message, simply because it was easier to catch this issue later,
        // instead of during tokenization.
        assert.throws((): any => validator`0182e2`, {
          message: [
            'Can not mix scientific notation with numbers starting with leading zeros. (line 1, col 1)',
            '  0182e2',
            '  ~~~~~~',
          ].join('\n'),
        });
        expect(validator`018.2`.matches(18.2)).toBe(true);
      });

      test('numbers with leading zeros that only contain base-8 digits create an error', () => {
        const act = (): any => validator`+ 01234567`;
        assert.throws(act, {
          message: [
            'Not allowed to use legacy octal syntax. Use 0o123 syntax instead. (line 1, col 3)',
            '  + 01234567',
            '    ~~~~~~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);

        assert.throws((): any => validator`001234567`, ValidatorSyntaxError);
        assert.throws((): any => validator`00123_4567`, ValidatorSyntaxError);
        assert.throws((): any => validator`00_1234567`, ValidatorSyntaxError);
        assert.throws((): any => validator`0_01234567`, ValidatorSyntaxError);
        assert.throws((): any => validator`_001234567`, ValidatorSyntaxError);
        assert.throws((): any => validator`001234567_`, ValidatorSyntaxError);
        assert.throws((): any => validator`001234567e2`, ValidatorSyntaxError);
        assert.throws((): any => validator`001234567.2`, ValidatorSyntaxError);
      });

      test('numbers with multiple zeros create an error', () => {
        const act = (): any => validator`+ 000`;
        assert.throws(act, {
          message: [
            'Not allowed to use legacy octal syntax. Use 0o123 syntax instead. (line 1, col 3)',
            '  + 000',
            '    ~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
        assert.throws((): any => validator`0_0`, ValidatorSyntaxError);
        assert.throws((): any => validator`00e1`, ValidatorSyntaxError);
        assert.throws((): any => validator`00.0`, ValidatorSyntaxError);
      });

      test('throws when a non-number appears after a sign', () => {
        const act = (): any => validator`- xyz`;
        assert.throws(act, {
          message: [
            'Expected a number after the sign. (line 1, col 3)',
            '  - xyz',
            '    ~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(() => validator`+ xyz`, ValidatorSyntaxError);
      });

      test('Not allowed to use a decimal that is not followed by anything', () => {
        const act = (): any => validator`23.`;
        assert.throws(act, {
          message: [
            'Failed to interpret this syntax. (line 1, col 3)',
            '  23.',
            '    ~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(() => validator`+ xyz`, ValidatorSyntaxError);
      });

      test("NaN isn't a valid numeric literal to match against", () => {
        const act = (): any => validator`NaN`;
        assert.throws(act, {
          message: [
            'Expected to find a type here. (line 1, col 1)',
            '  NaN',
            '  ~~~',
          ].join('\n'),
        });
        assert.throws(act, ValidatorSyntaxError);
      });
    });
  });
});
