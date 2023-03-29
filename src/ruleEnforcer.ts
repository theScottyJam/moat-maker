import { strict as assert } from 'node:assert';
import { InterpolationRule, Rule, TupleRule, UnionRule } from './types/parsingRules';
import { reprUnknownValue, UnreachableCaseError } from './util';
import { createValidatorAssertionError, ValidatorAssertionError } from './exceptions';
import { validatable, assertConformsToValidatableProtocol, hasValidatableProperty } from './validatableProtocol';
import { assertMatchesUnion, assertMatchesObject, getSimpleTypeOf } from './unionRuleEnforcer';

const isObject = (value: unknown): value is object => Object(value) === value;

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);

export function doesMatch(rule: Rule, target: unknown, interpolated: readonly unknown[]): boolean {
  try {
    assertMatches(rule, target, interpolated);
    return true;
  } catch (err) {
    if (err instanceof ValidatorAssertionError) {
      return false;
    }
    throw err;
  }
}

/** Throws ValidatorAssertionError if the value does not match. */
export function assertMatches<T>(
  rule: Rule,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string = '<receivedValue>',
): asserts target is T {
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
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be of type "${rule.type}" but got ${whatWasGot}.`,
      );
    }
  } else if (rule.category === 'primitiveLiteral') {
    if (target !== rule.value) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be ${reprUnknownValue(rule.value)} but got ${reprUnknownValue(target)}.`,
      );
    }
  } else if (rule.category === 'union') {
    assertMatchesUnion(rule, target, interpolated, lookupPath);
  } else if (rule.category === 'intersection') {
    for (const variant of rule.variants) {
      assertMatches(variant, target, interpolated, lookupPath);
    }
  } else if (rule.category === 'object') {
    assertMatchesObject(rule, target, interpolated, lookupPath);
  } else if (rule.category === 'array') {
    if (!Array.isArray(target)) {
      throw createValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
    }

    for (const [i, element] of target.entries()) {
      assertMatches(rule.content, element, interpolated, `${lookupPath}[${i}]`);
    }
  } else if (rule.category === 'tuple') {
    assertMatchesTuple(rule, target, interpolated, lookupPath);
  } else if (rule.category === 'iterator') {
    assertMatches(rule.iterableType, target, interpolated, lookupPath);

    if (!isIterable(target)) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      );
    }

    let i = 0;
    for (const entry of target) {
      assertMatches(rule.entryType, entry, interpolated, `[...${lookupPath}][${i}]`);
      ++i;
    }
  } else if (rule.category === 'interpolation') {
    assertMatchesInterpolation(rule, target, interpolated, lookupPath);
  } else {
    throw new UnreachableCaseError(rule);
  }
}

function assertMatchesTuple<T>(
  rule: TupleRule,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string,
): asserts target is T {
  if (!Array.isArray(target)) {
    throw createValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
  }

  const minSize = rule.content.length;
  const maxSize = rule.rest !== null
    ? Infinity
    : rule.content.length + rule.optionalContent.length;

  if (target.length < minSize || target.length > maxSize) {
    if (minSize === maxSize) {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    } else if (maxSize !== Infinity) {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have between ${minSize} and ${maxSize} entries, ` +
        `but found ${target.length}.`,
      );
    } else {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have at least ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    }
  }

  const restItems = [];
  for (const [i, element] of target.entries()) {
    const subRule: Rule | undefined = rule.content[i] ?? rule.optionalContent[i - rule.content.length];
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
}

function assertMatchesInterpolation<T>(
  rule: InterpolationRule,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string,
): asserts target is T {
  const valueToMatch = interpolated[rule.interpolationIndex];

  if (hasValidatableProperty(valueToMatch)) {
    assertConformsToValidatableProtocol(valueToMatch);

    valueToMatch[validatable](target, {
      failure: (...args) => createValidatorAssertionError(...args),
      at: lookupPath,
    });
  } else if (typeof valueToMatch === 'function') {
    if (Object(target).constructor !== valueToMatch || !(Object(target) instanceof valueToMatch)) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath}, which was ${reprUnknownValue(target)}, to be an instance of ${reprUnknownValue(valueToMatch)} ` +
        '(and not an instance of a subclass).',
      );
    }
  } else if (valueToMatch instanceof RegExp) {
    if (typeof target !== 'string') {
      throw createValidatorAssertionError(
        `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to be a string that matches the regular expression ${valueToMatch.toString()}`,
      );
    }
    if (target.match(valueToMatch) === null) {
      throw createValidatorAssertionError(
        `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to match the regular expression ${valueToMatch.toString()}`,
      );
    }
  } else if (isObject(valueToMatch)) {
    // TODO: It would be nice if we could do this check earlier, when the validator instance is first made
    // (There's already tests for this, so those tests can be updated as well).
    throw new TypeError(
      'Not allowed to interpolate a regular object into a validator. ' +
      '(Exceptions include classes, objects that define the validatable protocol, etc)',
    );
  } else if (!sameValueZero(target, valueToMatch)) {
    throw createValidatorAssertionError(
      `Expected ${lookupPath} to be the value ${reprUnknownValue(valueToMatch)} but got ${reprUnknownValue(target)}.`,
    );
  }
}
