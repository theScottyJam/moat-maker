import { strict as assert } from 'node:assert';
import { Rule } from './types/parseRules';
import { reprUnknownValue, UnreachableCaseError } from './util';
import { ValidatorAssertionError } from './exceptions';
import { validatable, conformsToValidatableProtocol } from './validatableProtocol';

const isObject = (value: unknown): value is object => Object(value) === value;

// Compares two values using JavaScript's SameValueZero algorithm.
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);

export function assertMatches<T>(rule: Rule, value: T, interpolated: readonly unknown[], lookupPath = '<receivedValue>'): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(value) !== rule.type) { // eslint-disable-line valid-typeof
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be of type "${rule.type}" but got type "${getSimpleTypeOf(value)}".`,
      );
    }
  } else if (rule.category === 'union') {
    if (!rule.variants.some(v => doesMatch(v, value, interpolated))) {
      throw new ValidatorAssertionError(
        "Received value did not match any of the union's variants.\n" +
        collectAssertionErrors(rule.variants, value, interpolated)
          .map((message, i) => `  Variant ${i + 1}: ${message}`)
          .join('\n'),
        "Received value did not match any of the union's variants.",
      );
    }
  } else if (rule.category === 'object') {
    if (!isObject(value)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an object but got ${reprUnknownValue(value)}.`);
    }

    const missingKeys = Object.keys(rule.content)
      .filter(key => !rule.content[key].optional)
      .filter(key => !(key in value));

    if (missingKeys.length > 0) {
      throw new ValidatorAssertionError(
        `${lookupPath} is missing the required fields: ` +
        missingKeys.map(key => JSON.stringify(key)).join(', '),
      );
    }

    for (const [key, iterRuleInfo] of Object.entries(rule.content)) {
      if (iterRuleInfo.optional && !(key in value)) continue;
      assertMatches(iterRuleInfo.rule, (value as any)[key], interpolated, `${lookupPath}.${key}`);
    }
  } else if (rule.category === 'array') {
    if (!Array.isArray(value)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(value)}.`);
    }

    for (const [i, element] of value.entries()) {
      assertMatches(rule.content, element, interpolated, `${lookupPath}[${i}]`);
    }
  } else if (rule.category === 'interpolation') {
    const valueToMatch = interpolated[rule.interpolationIndex];

    if (conformsToValidatableProtocol(valueToMatch)) {
      assert(typeof valueToMatch[validatable] === 'function'); // <-- TODO: Test
      valueToMatch[validatable](value, lookupPath);
      return value;
    }

    if (typeof valueToMatch === 'function' || typeof valueToMatch === 'object') throw new Error('Not Implemented');

    if (!sameValueZero(value, valueToMatch)) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be the value ${reprUnknownValue(valueToMatch)} but got ${reprUnknownValue(value)}.`,
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
