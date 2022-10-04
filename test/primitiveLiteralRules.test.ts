/* eslint-disable no-new-wrappers */

import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('primitive literal rules', () => {
  describe('string', () => {
    test('accepts equivalent string inputs', () => {
      const v = validator`'xyz'`;
      v.getAsserted('xyz');
    });

    test('rejects incorrect strings', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.getAsserted('xy');
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got "xy".' });
    });

    test('rejects numeric inputs', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.getAsserted(2);
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got 2.' });
    });

    test('rejects string objects', () => {
      const v = validator`'xyz'`;
      const act = (): any => v.getAsserted(new String('xyz'));
      assert.throws(act, ValidatorAssertionError);
      assert.throws(act, { message: 'Expected <receivedValue> to be "xyz" but got [object String].' });
    });

    test('produces the correct rule', () => {
      const v = validator`'xyz'`;
      expect(v.rule).toMatchObject({
        category: 'primitiveLiteral',
        value: 'xyz',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
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

      test('encounter EOF before closing quote', () => {
        const act = (): any => validator`'xyz`;
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(act, {
          message: [
            'Expected to find a quote to end the string literal. (line 1, col 1)',
            "  'xyz",
            '  ~~~~',
          ].join('\n'),
        });
      });

      test('encounter interpolation point before closing quote', () => {
        const act = (): any => validator`'xyz${42}abc'`;
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(act, {
          message: [
            'Expected to find a quote to end the string literal. (line 1, col 1)',
            "  'xyzabc'", // TODO: It would be good to add `${…}` in the middle of that output.
            '  ~~~~',
          ].join('\n'),
        });
      });
    });
  });
});
