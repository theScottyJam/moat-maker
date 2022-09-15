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

interface UnionRule {
  readonly category: 'union'
  readonly variants: Rule[]
}

type Rule = SimpleRule | NoopRule | UnionRule;

interface Validator {
  readonly matches: (value: unknown) => boolean
  readonly assertMatches: <T>(value: T) => T
  readonly rule: Rule
}

export class ValidatorAssertionError extends Error {
  name = 'ValidatorAssertionError';
  public readonly conciseMessage;

  /// `message` will sometimes be multiline while `conciseMessage` should always fit on one line.
  /// `conciseMessage` is useful when you need to combine multipler error messages together into one.
  constructor(message: string, conciseMessage = message) {
    super(message);
    this.conciseMessage = conciseMessage;
  }
}

class UnreachableCaseError extends Error {
  name = 'UnreachableCaseError';
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
  return validator.fromRule(inputStringToRule([...parts]));
}

validator.fromRule = function(rule_: Rule): Validator {
  const rule = freezeRule(rule_);

  const instance: Validator = Object.freeze({
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

function freezeRule(rule: Rule): Rule {
  // shallow-copy-and-freeze function
  const f = <T>(obj: T): T => (
    Object.isFrozen(obj)
      ? obj
      : Object.freeze({ ...obj })
  );

  if (rule.category === 'simple' || rule.category === 'noop') {
    return f({ ...rule });
  } else if (rule.category === 'union') {
    return f({
      ...rule,
      variants: [...rule.variants], // <-- TODO: Freeze the array and test that.
    });
  } else {
    throw new UnreachableCaseError(rule);
  }
}

function inputStringToRule(parts: string[]): Rule {
  const rawRule = parts[0];

  if (rawRule === 'unknown' || rawRule === 'any') {
    return freezeRule({
      category: 'noop',
    });
  } else if ((allSimpleTypes as string[]).includes(rawRule)) {
    return freezeRule({
      category: 'simple',
      type: rawRule as simpleTypeVariant,
    });
  } else if (rawRule.includes('|')) {
    return freezeRule({
      category: 'union',
      variants: rawRule.split('|').map(x => x.trim()).map(x => inputStringToRule([x])),
    });
  } else {
    throw new Error('Invalid input');
  }
}

function assertMatches<T>(rule: Rule, value: T): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(value) !== rule.type) { // eslint-disable-line valid-typeof
      throw new ValidatorAssertionError(
        `Expected a value of type "${rule.type}" but got type "${getSimpleTypeOf(value)}".`,
      );
    }
  } else if (rule.category === 'union') {
    const subValidators = rule.variants.map(v => validator.fromRule(v));
    if (!subValidators.some(v => v.matches(value))) {
      throw new ValidatorAssertionError(
        "Recieved value did not match any of the union's variants.\n" +
        collectAssertionErrors(subValidators, value)
          .map((message, i) => `  Variant ${i + 1}: ${message}`)
          .join('\n'),
        "Recieved value did not match any of the union's variants.",
      );
    }
  } else {
    throw new UnreachableCaseError(rule);
  }

  return value;
}

function collectAssertionErrors(validators: Validator[], value: unknown): string[] {
  return validators
    .map(v => {
      try {
        v.assertMatches(value);
        throw new Error('Internal error: Expected assertMatches() to throw');
      } catch (err) {
        if (err instanceof ValidatorAssertionError) {
          return err.conciseMessage;
        }
        throw err;
      }
    });
}
