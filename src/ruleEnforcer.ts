import { strict as assert } from 'node:assert';
import { InterpolationRule, ObjectRule, ObjectRuleContentValue, Rule, TupleRule, UnionRule } from './types/parsingRules';
import { indentMultilineString, reprUnknownValue, UnreachableCaseError } from './util';
import { createValidatorAssertionError, createValidatorSyntaxError, ValidatorAssertionError } from './exceptions';
import { validatable, conformsToValidatableProtocol } from './validatableProtocol';
import { isIdentifier } from './tokenStream';

const isObject = (value: unknown): value is object => Object(value) === value;

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);

/**
 * Returns all object entries, regardless of if they're enumerable or have symbol keys.
 */
function * allObjectEntries(obj: any): Generator<[string | symbol, unknown]> {
  for (const key of Object.getOwnPropertyNames(obj)) {
    yield [key, obj[key]];
  }
  for (const symb of Object.getOwnPropertySymbols(obj)) {
    yield [symb, obj[symb]];
  }
}

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
    const unionVariants = flattenUnionVariants(rule);
    if (!unionVariants.some(v => doesMatch(v, target, interpolated))) {
      throw createValidatorAssertionError(
        'Failed to match against every variant of a union.\n' +
        collectAssertionErrors(unionVariants, target, interpolated, lookupPath)
          .map((message, i) => `  Variant ${i + 1}: ${indentMultilineString(message, 4).slice(4)}`)
          .join('\n'),
      );
    }
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

function assertMatchesObject<T>(
  rule: ObjectRule,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string,
): asserts target is T {
  if (!isObject(target)) {
    throw createValidatorAssertionError(`Expected ${lookupPath} to be an object but got ${reprUnknownValue(target)}.`);
  }

  const calcSubLookupPath = (lookupPath: string, key: string | symbol): string => {
    if (typeof key === 'string' && isIdentifier(key)) {
      return `${lookupPath}.${key}`;
    } else if (typeof key === 'string') {
      return `${lookupPath}[${JSON.stringify(key)}]`;
    } else {
      return `${lookupPath}[Symbol(${key.description ?? ''})]`;
    }
  };

  const content = new Map<string | symbol, ObjectRuleContentValue[]>(
    [...rule.content.entries()]
      .map(([key, value]) => [key, [value]]),
  );

  // Add dynamic key entries to the content map.
  for (const [interpolationIndex, value] of rule.dynamicContent) {
    let key = interpolated[interpolationIndex];
    if (typeof key === 'number') {
      key = String(key);
    }

    if (typeof key !== 'string' && typeof key !== 'symbol') {
      throw createValidatorSyntaxError(
        'Attempted to match against a mal-formed validator instance. ' +
        `Its interpolation #${interpolationIndex + 1} must be either of type string, symbol, or number. ` +
        `Got type ${getSimpleTypeOf(key)}.`,
      );
    }

    let existingContentEntry = content.get(key);
    if (existingContentEntry === undefined) {
      existingContentEntry = [];
      content.set(key, existingContentEntry);
    }
    existingContentEntry.push(value);
  }

  const missingKeys = [...content.entries()]
    .filter(([key, value]) => !value.every(({ optional }) => optional))
    .filter(([key, value]) => !(key in target))
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw createValidatorAssertionError(
      `${lookupPath} is missing the required properties: ` +
      missingKeys.map(key => reprUnknownValue(key)).join(', '),
    );
  }

  if (rule.index !== null) {
    for (const [key, value] of allObjectEntries(target)) {
      const numericKey = typeof key === 'string' ? Number(key) : NaN;
      const matchesIndexSignature = (
        doesMatch(rule.index.key, key, interpolated) ||
        // Handles the case where we're matching the key against the `number` rule.
        // The key has to be turned into a number first, before the `number` rule will take it.
        (!isNaN(numericKey) && doesMatch(rule.index.key, numericKey, interpolated))
      );
      if (matchesIndexSignature) {
        assertMatches(rule.index.value, value, interpolated, calcSubLookupPath(lookupPath, key));
      }
    }
  }

  for (const [key, iterRuleInfoList] of content) {
    for (const iterRuleInfo of iterRuleInfoList) {
      if (iterRuleInfo.optional && !(key in target)) continue;
      assertMatches(iterRuleInfo.rule, (target as any)[key], interpolated, calcSubLookupPath(lookupPath, key));
    }
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

  if (conformsToValidatableProtocol(valueToMatch)) {
    assert(typeof valueToMatch[validatable] === 'function'); // <-- TODO: Test

    valueToMatch[validatable](target, {
      failure: (...args) => createValidatorAssertionError(...args),
      at: lookupPath,
    });

    return;
  }

  if (typeof valueToMatch === 'function') {
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

function flattenUnionVariants(rule: UnionRule): readonly Rule[] {
  return rule.variants.flatMap(variant => {
    return variant.category === 'union'
      ? flattenUnionVariants(variant)
      : [variant];
  });
}

function collectAssertionErrors(
  rules: readonly Rule[],
  value: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): readonly string[] {
  return rules
    .map(rule => {
      try {
        assertMatches(rule, value, interpolated, lookupPath);
        throw new Error('Internal error: Expected assertMatches() to throw');
      } catch (err) {
        if (err instanceof ValidatorAssertionError) {
          return err.message;
        }
        throw err;
      }
    });
}

/**
 * Similar to `typeof`, but it correctly handles `null`, and it treats functions as objects.
 * This tries to mimic how TypeScript compares simple types.
 */
function getSimpleTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  } else if (typeof value === 'function') {
    return 'object';
  } else {
    return typeof value;
  }
}
