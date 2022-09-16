import { Rule } from './types/parseRules';
import { UnreachableCaseError } from './util';
import { ValidatorAssertionError } from './exceptions';

export function assertMatches<T>(rule: Rule, value: T): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(value) !== rule.type) { // eslint-disable-line valid-typeof
      throw new ValidatorAssertionError(
        `Expected a value of type "${rule.type}" but got type "${getSimpleTypeOf(value)}".`,
      );
    }
  } else if (rule.category === 'union') {
    if (!rule.variants.some(v => doesMatch(v, value))) {
      throw new ValidatorAssertionError(
        "Recieved value did not match any of the union's variants.\n" +
        collectAssertionErrors(rule.variants, value)
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

export function doesMatch(rule: Rule, value: unknown): boolean {
  try {
    assertMatches(rule, value);
    return true;
  } catch (err) {
    if (err instanceof ValidatorAssertionError) {
      return false;
    }
    throw err;
  }
}

function collectAssertionErrors(rules: Rule[], value: unknown): string[] {
  return rules
    .map(rule => {
      try {
        assertMatches(rule, value);
        throw new Error('Internal error: Expected assertMatches() to throw');
      } catch (err) {
        if (err instanceof ValidatorAssertionError) {
          return err.conciseMessage;
        }
        throw err;
      }
    });
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
