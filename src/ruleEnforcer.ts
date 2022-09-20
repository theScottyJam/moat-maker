import { Rule } from './types/parseRules';
import { UnreachableCaseError } from './util';
import { ValidatorAssertionError } from './exceptions';

const reprPrimitive = (value: unknown): string => {
  if (!isPrimitive(value)) throw new Error('UNREACHABLE');
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return String(value) + 'n';
  if (value === null) return 'null';
  return String(value);
};

const isPrimitive = (value: unknown): boolean => value === null || (
  typeof value !== 'function' && typeof value !== 'object'
);

// Compares two values using JavaScript's SameValueZero algorithm.
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);

export function assertMatches<T>(rule: Rule, value: T, interpolated: readonly unknown[]): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(value) !== rule.type) { // eslint-disable-line valid-typeof
      throw new ValidatorAssertionError(
        `Expected a value of type "${rule.type}" but got type "${getSimpleTypeOf(value)}".`,
      );
    }
  } else if (rule.category === 'union') {
    if (!rule.variants.some(v => doesMatch(v, value, interpolated))) {
      throw new ValidatorAssertionError(
        "Recieved value did not match any of the union's variants.\n" +
        collectAssertionErrors(rule.variants, value, interpolated)
          .map((message, i) => `  Variant ${i + 1}: ${message}`)
          .join('\n'),
        "Recieved value did not match any of the union's variants.",
      );
    }
  } else if (rule.category === 'interpolation') {
    const valueToMatch = interpolated[rule.interpolationIndex];
    if (typeof valueToMatch === 'function' || typeof valueToMatch === 'object') throw new Error('Not Implemented');

    // Represent an unknown value that's supposed to be a primitive
    const reprExpectedPrimitive = (value: unknown): string => {
      if (typeof value === 'object' && value !== null) return 'an object';
      if (typeof value === 'function') return 'a function';
      if (isPrimitive(value)) return reprPrimitive(value);
      return String(value);
    };

    if (!sameValueZero(value, valueToMatch)) {
      throw new ValidatorAssertionError(
        `Expected the value ${reprPrimitive(valueToMatch)} but got ${reprExpectedPrimitive(value)}.`,
      );
    }
  } else {
    throw new UnreachableCaseError(rule);
  }

  return value;
}

export function doesMatch(rule: Rule, value: unknown, interpolated: readonly unknown[]): boolean {
  try {
    assertMatches(rule, value, interpolated);
    return true;
  } catch (err) {
    if (err instanceof ValidatorAssertionError) {
      return false;
    }
    throw err;
  }
}

function collectAssertionErrors(rules: Rule[], value: unknown, interpolated: readonly unknown[]): string[] {
  return rules
    .map(rule => {
      try {
        assertMatches(rule, value, interpolated);
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
