import { strict as assert } from 'node:assert';
import { validator, ValidatorAssertionError, ValidatorSyntaxError } from '../src';

describe('intersection rules', () => {
  test('accepts a value that matches all variants of the intersection', () => {
    const v = validator`{ x: number } & { y: number } & { z: number }`;
    v.getAsserted({ x: 2, y: 3, z: 4 });
  });

  test("rejects value that does not match one of the intersection's variants", () => {
    const v = validator`{ x: number } & { y: number } & { z: number }`;
    const act = (): any => v.getAsserted({ x: 2, y: 3 });
    assert.throws(act, { message: '<receivedValue> is missing the required properties: "z"' });
    assert.throws(act, ValidatorAssertionError);
    assert.throws((): any => v.getAsserted({ x: 2, z: 3 }), ValidatorAssertionError);
    assert.throws((): any => v.getAsserted({ y: 2, z: 3 }), ValidatorAssertionError);
    assert.throws((): any => v.getAsserted({}), ValidatorAssertionError);
    assert.throws((): any => v.getAsserted(42), ValidatorAssertionError);
  });

  test('produces the correct rule', () => {
    const v = validator`string & null & undefined`;
    expect(v.rule).toMatchObject({
      category: 'intersection',
      variants: [
        {
          category: 'simple',
          type: 'string',
        }, {
          category: 'simple',
          type: 'null',
        }, {
          category: 'simple',
          type: 'undefined',
        },
      ],
    });
    assert(v.rule.category === 'intersection');
    expect(Object.isFrozen(v.rule)).toBe(true);
    expect(Object.isFrozen(v.rule.variants)).toBe(true);
  });

  test('works with funky whitespace', () => {
    const v = validator({ raw: [' \tnumber&string \t&\t undefined \t'] });
    expect(v.rule).toMatchObject({
      category: 'intersection',
      variants: [
        {
          category: 'simple',
          type: 'number',
        }, {
          category: 'simple',
          type: 'string',
        }, {
          category: 'simple',
          type: 'undefined',
        },
      ],
    });
  });

  test('behaves properly when there is only one intersection in the union type', () => {
    const v = validator.fromRule({
      category: 'intersection',
      variants: [{
        category: 'simple',
        type: 'string',
      }],
    });

    v.getAsserted('xyz');
    expect(v.matches(2)).toBe(false);
  });

  test('Throws a syntax error when there\'s nothing to the right of the "&"', () => {
    const act = (): any => validator`number & `;
    assert.throws(act, {
      message: [
        'Unexpected EOF. (line 1, col 10)',
        '  number &',
        '           ~',
      ].join('\n'),
    });
    assert.throws(act, ValidatorSyntaxError);
  });
});
