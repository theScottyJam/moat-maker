type simpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';
const allSimpleTypes: simpleTypeVariant[] = [
  'string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined',
];

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

class UnreachableCaseError extends Error {
  constructor(value: never) {
    super(`Unexpected value ${String(value)}`);
  }
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
    return validator.fromRule({ category: 'noop' as const });
  } else if ((allSimpleTypes as string[]).includes(rawRule)) {
    return validator.fromRule({
      category: 'simple' as const,
      type: rawRule as simpleTypeVariant,
    });
  } else {
    throw new Error('Invalid input');
  }
}

validator.fromRule = function(rule_: Rule): Validator {
  let rule: Rule;
  if (rule_.category === 'simple' || rule_.category === 'noop') {
    rule = f({ ...rule_ });
  } else {
    throw new UnreachableCaseError(rule_);
  }

  const instance: Validator = f({
    assertMatches<T>(value: T): T {
      return assertMatches(rule, value);
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
    rule,
  });

  return instance;
};

function assertMatches<T>(rule: Rule, value: T): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(value) !== rule.type) { // eslint-disable-line valid-typeof
      throw new ValidatorAssertionError(
        `Expected a value of type "${rule.type}" but got type "${getSimpleTypeOf(value)}".`,
      );
    }
  }

  return value;
}
