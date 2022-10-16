import { strict as assert } from 'assert';
import { validator, ValidatorSyntaxError } from '../src';

describe('comments', () => {
  test('ignores block comments between tokens', () => {
    const v = validator`{ x /* : , ! ignore me */ : /* also : string ignore */ number }`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  test('ignores multi-line block comments', () => {
    const v = validator`{
      x: number,
      /* Lots of
      stuff here
      */
      y: string
    }`;
    expect(v.matches({ x: 2, y: 'xyz' })).toBe(true);
    expect(v.matches({ x: 2 })).toBe(false);
  });

  test('ignores single-line comments', () => {
    const v = validator`{
      x: number, // ignore , : string me
      y: string
    }`;
    expect(v.matches({ x: 2, y: 'xyz' })).toBe(true);
    expect(v.matches({ x: 2 })).toBe(false);
  });

  test('handles comment tokens inside of a block comment', () => {
    const v = validator`{ x /* /* // */ : number }`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  test('handles comment tokens inside of a single-line comment', () => {
    const v = validator`{ x // */ /* //
      : number }`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  // Making sure the closest */ is matched with a /*.
  test('handles multiple block comments', () => {
    const v = validator`{ x /* */ : /* */ number }`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  // Makes sure the parser can eat whitespace and comments interchangeably
  test('handles multiple block comments with nothing in between', () => {
    const v = validator`{ x: /**/ /**/ /**/ number }`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  test('allows single-line at the last line (i.e. it\'s on a line that does not end with a new line character)', () => {
    const v = validator`{ x: number } // hi there`;
    expect(v.matches({ x: 2 })).toBe(true);
    expect(v.matches({ x: 'xyz' })).toBe(false);
  });

  test('gives a nice error if a block comment is missing its closing token', () => {
    const act = (): any => validator`{ x: /* #@$ number }`;
    assert.throws(act, {
      message: [
        'This block comment never got closed. (line 1, col 6)',
        '  { x: /* #@$ number }',
        '       ~~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
