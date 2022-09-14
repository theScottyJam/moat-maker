type simpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';

interface SimpleRule {
  readonly category: 'simple'
  readonly type: simpleTypeVariant
}

interface NoopRule {
  readonly category: 'noop'
}

type Rule = SimpleRule | NoopRule;

interface Validator {
  readonly matches: (value: unknown) => boolean
  readonly assertMatches: <T>(value: T) => T
  readonly rule: Rule
}

const f = Object.freeze;

export class ValidatorAssertionError extends Error {
  name = 'ValidatorAssertionError';
}

/// Similar to `typeof`, but it correctly handles `null`, and it treats functions as objects.
/// This tries to mimic how TypeScript compares simple types.
function getSimpleTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  } else if (typeof value === 'function') {
    return 'object';
  } else {
    return typeof value;
  }
}

export function validator(parts: TemplateStringsArray): Validator {
  const rawRule = parts[0];

  if (rawRule === 'unknown' || rawRule === 'any') {
    return f({
      assertMatches<T>(value: T): T {
        return value;
      },
      matches(value: unknown) {
        return true;
      },
      rule: f({ category: 'noop' as const }),
    });
  } else {
    let simpleType: simpleTypeVariant;
    const allSimpleTypes: simpleTypeVariant[] = ['string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined'];
    if ((allSimpleTypes as string[]).includes(rawRule)) {
      simpleType = rawRule as simpleTypeVariant;
    } else {
      throw new Error('Invalid input');
    }

    const instance = f({
      assertMatches<T>(value: T): T {
        if (getSimpleTypeOf(value) !== simpleType) { // eslint-disable-line valid-typeof
          throw new ValidatorAssertionError(`Expected a value of type "${simpleType}" but got type "${getSimpleTypeOf(value)}".`);
        }

        return value;
      },
      matches(value: unknown) {
        try {
          instance.assertMatches(value);
          return true;
        } catch (err) {
          if (err instanceof ValidatorAssertionError) {
            return false;
          }
          throw err;
        }
      },
      rule: f({
        category: 'simple' as const,
        type: simpleType,
      }),
    });

    return instance;
  }
}
