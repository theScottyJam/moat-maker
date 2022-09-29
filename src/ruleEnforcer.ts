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

export function assertMatches<T>(rule: Rule, target: T, interpolated: readonly unknown[], lookupPath = '<receivedValue>'): T {
  if (rule.category === 'noop') {
    // noop
  } else if (rule.category === 'simple') {
    if (getSimpleTypeOf(target) !== rule.type) { // eslint-disable-line valid-typeof
      let whatWasGot = `type "${getSimpleTypeOf(target)}"`;
      if (Array.isArray(target)) {
        whatWasGot = 'an array';
      } else if (target instanceof Function) {
        whatWasGot = 'a function';
      }
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be of type "${rule.type}" but got ${whatWasGot}.`,
      );
    }
  } else if (rule.category === 'union') {
    if (!rule.variants.some(v => doesMatch(v, target, interpolated))) {
      throw new ValidatorAssertionError(
        "Received value did not match any of the union's variants.\n" +
        collectAssertionErrors(rule.variants, target, interpolated)
          .map((message, i) => `  Variant ${i + 1}: ${message}`)
          .join('\n'),
        "Received value did not match any of the union's variants.",
      );
    }
  } else if (rule.category === 'object') {
    if (!isObject(target)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an object but got ${reprUnknownValue(target)}.`);
    }

    const missingKeys = [...rule.content.entries()]
      .filter(([key, value]) => !value.optional)
      .filter(([key, value]) => !(key in target))
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new ValidatorAssertionError(
        `${lookupPath} is missing the required fields: ` +
        missingKeys.map(key => JSON.stringify(key)).join(', '),
      );
    }

    for (const [key, iterRuleInfo] of rule.content) {
      if (iterRuleInfo.optional && !(key in target)) continue;
      assertMatches(iterRuleInfo.rule, (target as any)[key], interpolated, `${lookupPath}.${key}`);
    }
  } else if (rule.category === 'array') {
    if (!Array.isArray(target)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
    }

    for (const [i, element] of target.entries()) {
      assertMatches(rule.content, element, interpolated, `${lookupPath}[${i}]`);
    }
  } else if (rule.category === 'tuple') {
    if (!Array.isArray(target)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
    }

    const minSize = rule.content.length;
    const maxSize = rule.rest !== null
      ? Infinity
      : rule.content.length + rule.optionalContent.length;

    if (target.length < minSize || target.length > maxSize) {
      if (minSize === maxSize) {
        throw new ValidatorAssertionError(
          `Expected the ${lookupPath} array to have ${minSize} entries, but found ${target.length}.`,
        );
      } else if (maxSize !== Infinity) {
        throw new ValidatorAssertionError(
          `Expected the ${lookupPath} array to have between ${minSize} and ${maxSize} entries, ` +
          `but found ${target.length}.`,
        );
      } else {
        throw new ValidatorAssertionError(
          `Expected the ${lookupPath} array to have at least ${minSize} entries, but found ${target.length}.`,
        );
      }
    }

    const restItems = [];
    for (const [i, element] of target.entries()) {
      const subRule = rule.content[i] ?? rule.optionalContent[i - rule.content.length];
      if (subRule !== undefined) {
        assertMatches(subRule, element, interpolated, `${lookupPath}[${i}]`);
      } else {
        restItems.push(element);
      }
    }

    if (rule.rest !== null) {
      const restStartIndex = rule.content.length + rule.optionalContent.length;
      assertMatches(rule.rest, restItems, interpolated, `${lookupPath}.slice(${restStartIndex})`);
    }
  } else if (rule.category === 'interpolation') {
    const valueToMatch = interpolated[rule.interpolationIndex];

    if (conformsToValidatableProtocol(valueToMatch)) {
      assert(typeof valueToMatch[validatable] === 'function'); // <-- TODO: Test
      valueToMatch[validatable](target, lookupPath);
      return target;
    }

    if (typeof valueToMatch === 'function' || typeof valueToMatch === 'object') throw new Error('Not Implemented');

    if (!sameValueZero(target, valueToMatch)) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be the value ${reprUnknownValue(valueToMatch)} but got ${reprUnknownValue(target)}.`,
      );
    }
  } else {
    throw new UnreachableCaseError(rule);
  }

  return target;
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

function collectAssertionErrors(rules: readonly Rule[], value: unknown, interpolated: readonly unknown[]): readonly string[] {
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
