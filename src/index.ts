import { createTokenStream, TokenStream } from './tokenStream';
import { ValidatorAssertionError, ValidatorSyntaxError } from './exceptions';
import { UnreachableCaseError } from './util';
export { ValidatorAssertionError, ValidatorSyntaxError };

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
  const tokenStream = createTokenStream(parts);
  if (tokenStream.peek().category === 'eof') {
    throw new ValidatorSyntaxError('The validator had no content.');
  }
  return validator.fromRule(ruleFromTokenStream(tokenStream));
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
  const f = <T>(objOrArray: T): T => {
    if (Object.isFrozen(objOrArray)) {
      return objOrArray;
    }
    return Object.freeze(
      Array.isArray(objOrArray) ? [...objOrArray] : { ...objOrArray },
    ) as T;
  };

  if (rule.category === 'simple' || rule.category === 'noop') {
    return f({ ...rule });
  } else if (rule.category === 'union') {
    return f({
      ...rule,
      variants: f([...rule.variants]),
    });
  } else {
    throw new UnreachableCaseError(rule);
  }
}

function ruleFromTokenStream(tokenStream: TokenStream): Rule {
  const token = tokenStream.next();
  if (token.category === 'eof') {
    throw new ValidatorSyntaxError('Unexpected EOF.', tokenStream.originalText, token.range);
  }

  let rule: Rule;
  if (token.category === 'identifier') {
    const identifier = token.value;
    if (identifier === 'unknown' || identifier === 'any') {
      rule = freezeRule({
        category: 'noop',
      });
    } else if ((allSimpleTypes as string[]).includes(identifier)) {
      rule = freezeRule({
        category: 'simple',
        type: identifier as simpleTypeVariant,
      });
    } else {
      // TODO: Add tests for this
      throw new Error('Invalid input');
    }
  } else {
    // TODO: Add tests for this
    throw new Error('Invalid input');
  }

  if (tokenStream.peek().value === '|') {
    tokenStream.next();
    const subRule = ruleFromTokenStream(tokenStream);
    const subRules = subRule.category === 'union'
      ? subRule.variants
      : [subRule];

    return freezeRule({
      category: 'union',
      variants: [rule, ...subRules],
    });
  } else {
    const nextToken = tokenStream.peek();
    if (nextToken.category !== 'eof') {
      throw new ValidatorSyntaxError('Expected EOF.', tokenStream.originalText, nextToken.range);
    }

    return rule;
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
