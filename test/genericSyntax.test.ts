import { strict as assert } from 'node:assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('generic syntax', () => {
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

  test('throws when an unexpected token is found where a type is expected', () => {
    const act = (): any => validator`string | @`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Expected to find a type here. (line 1, col 10)',
        '  string | @',
        '           ~',
      ].join('\n'),
    });
  });

  test('throws when an invalid identifier is found where a type is expected', () => {
    const act = (): any => validator`string | TRUE`;
    assert.throws(act, ValidatorSyntaxError);
    assert.throws(act, {
      message: [
        'Expected to find a type here. (line 1, col 10)',
        '  string | TRUE',
        '           ~~~~',
      ].join('\n'),
    });
  });

  describe('parentheses', () => {
    test('can be used to group types', () => {
      const v = validator`(string | boolean)[]`;
      v.getAsserted(['x', true]);
    });

    test('can be used with a single simple rule in it', () => {
      const v = validator`(string)[]`;
      v.getAsserted(['x']);
    });

    test('produces the correct rule', () => {
      const v = validator`(string)`;
      expect(v.rule).toMatchObject({
        category: 'simple',
        type: 'string',
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });

    test('union types are flattened through parentheses', () => {
      const v = validator`number | (string | boolean) | ((null)) | undefined`;
      expect(v.rule).toMatchObject({
        category: 'union',
        variants: [
          { category: 'simple', type: 'number' },
          { category: 'simple', type: 'string' },
          { category: 'simple', type: 'boolean' },
          { category: 'simple', type: 'null' },
          { category: 'simple', type: 'undefined' },
        ],
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });

    test('union types are flattened through parentheses (test 2)', () => {
      const v = validator`(number | null) | ((string | boolean))`;
      expect(v.rule).toMatchObject({
        category: 'union',
        variants: [
          { category: 'simple', type: 'number' },
          { category: 'simple', type: 'null' },
          { category: 'simple', type: 'string' },
          { category: 'simple', type: 'boolean' },
        ],
      });
      expect(Object.isFrozen(v.rule)).toBe(true);
    });

    describe('syntax', () => {
      test('throws a syntax error if the parentheses are empty', () => {
        const act = (): any => validator`()`;
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(act, {
          message: [
            'Expected to find a type here. (line 1, col 2)',
            '  ()',
            '   ~',
          ].join('\n'),
        });
      });

      test('throws a syntax error if a closing parentheses is not where it should be', () => {
        const act = (): any => validator`(string number)`;
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(act, {
          message: [
            'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
            '  (string number)',
            '          ~~~~~~',
          ].join('\n'),
        });
      });

      test('throws a syntax error if eof is reaches without a closing parentheses', () => {
        const act = (): any => validator`(string`;
        assert.throws(act, ValidatorSyntaxError);
        assert.throws(act, {
          message: [
            'Expected to find a closing parentheses (`)`) here. (line 1, col 8)',
            '  (string',
            '         ~',
          ].join('\n'),
        });
      });

      test('throws a syntax error if an interpolation point is reaches without a closing parentheses', () => {
        const act = (): any => validator`(string ${42} number)`;
        assert.throws(act, ValidatorSyntaxError);
        // TODO: It would be nice if we put `${…}` in the output error string, and put the error squiggle
        // underline underneath it
        assert.throws(act, {
          message: [
            'Expected to find a closing parentheses (`)`) here. (line 1, col 9)',
            '  (string  number)',
            '          ~',
          ].join('\n'),
        });
      });
    });
  });
});
