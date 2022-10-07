import { strict as assert } from 'node:assert';
import { Rule, UnionRule } from './types/parseRules';
import { reprUnknownValue, UnreachableCaseError } from './util';
import { ValidatorAssertionError } from './exceptions';
import { validatable, conformsToValidatableProtocol } from './validatableProtocol';
import { isIdentifier } from './tokenStream';

const isObject = (value: unknown): value is object => Object(value) === value;

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);

// Compares two values using JavaScript's SameValueZero algorithm.
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);

/// Returns all object entries, regardless of if they're enumerable or have symbol keys.
function * allObjectEntries(obj: any): Generator<[string | symbol, unknown]> {
  for (const key of Object.getOwnPropertyNames(obj)) {
    yield [key, obj[key]];
  }
  for (const symb of Object.getOwnPropertySymbols(obj)) {
    yield [symb, obj[symb]];
  }
}

export function assertMatches<T>(rule: Rule, target: T, interpolated: readonly unknown[], lookupPath = '<receivedValue>'): asserts target is T {
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
  } else if (rule.category === 'primitiveLiteral') {
    if (target !== rule.value) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be ${reprUnknownValue(rule.value)} but got ${reprUnknownValue(target)}.`,
      );
    }
  } else if (rule.category === 'union') {
    const unionVariants = flattenUnionVariants(rule);
    if (!unionVariants.some(v => doesMatch(v, target, interpolated))) {
      throw new ValidatorAssertionError(
        'Failed to match against every variant of a union.\n' +
        collectAssertionErrors(unionVariants, target, interpolated, lookupPath)
          .map((message, i) => `  Variant ${i + 1}: ${message}`)
          .join('\n'),
      );
    }
  } else if (rule.category === 'intersection') {
    for (const variant of rule.variants) {
      assertMatches(variant, target, interpolated, lookupPath);
    }
  } else if (rule.category === 'object') {
    if (!isObject(target)) {
      throw new ValidatorAssertionError(`Expected ${lookupPath} to be an object but got ${reprUnknownValue(target)}.`);
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

    const missingKeys = [...rule.content.entries()]
      .filter(([key, value]) => !value.optional)
      .filter(([key, value]) => !(key in target))
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new ValidatorAssertionError(
        `${lookupPath} is missing the required properties: ` +
        missingKeys.map(key => JSON.stringify(key)).join(', '),
      );
    }

    if (rule.index !== null) {
      for (const [key, value] of allObjectEntries(target)) {
        if (doesMatch(rule.index.key, key, interpolated)) {
          assertMatches(rule.index.value, value, interpolated, calcSubLookupPath(lookupPath, key));
        }
      }
    }

    for (const [key, iterRuleInfo] of rule.content) {
      if (iterRuleInfo.optional && !(key in target)) continue;
      assertMatches(iterRuleInfo.rule, (target as any)[key], interpolated, calcSubLookupPath(lookupPath, key));
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
      const subRule: Rule = rule.content[i] ?? rule.optionalContent[i - rule.content.length];
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
  } else if (rule.category === 'iterator') {
    assertMatches(rule.iterableType, target, interpolated, lookupPath);

    if (!isIterable(target)) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      );
    }

    let i = 0;
    for (const entry of target) {
      assertMatches(rule.entryType, entry, interpolated, `[...${lookupPath}][${i}]`);
      ++i;
    }
  } else if (rule.category === 'interpolation') {
    const valueToMatch = interpolated[rule.interpolationIndex];

    if (conformsToValidatableProtocol(valueToMatch)) {
      assert(typeof valueToMatch[validatable] === 'function'); // <-- TODO: Test
      valueToMatch[validatable](target, lookupPath);
      return;
    }

    if (typeof valueToMatch === 'function') {
      // TODO: Maybe also do an instanceof check to prevent { constructor: ... } from working
      if (Object(target).constructor !== valueToMatch) {
        throw new ValidatorAssertionError(
          `Expected ${lookupPath}, which is ${reprUnknownValue(target)}, to match ${reprUnknownValue(valueToMatch)} ` +
          '(via its validatable protocol).',
        );
      }
      return;
    }

    if (!sameValueZero(target, valueToMatch)) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be the value ${reprUnknownValue(valueToMatch)} but got ${reprUnknownValue(target)}.`,
      );
    }
  } else {
    throw new UnreachableCaseError(rule);
  }
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

function flattenUnionVariants(rule: UnionRule): readonly Rule[] {
  return rule.variants.flatMap(variant => {
    return variant.category === 'union'
      ? flattenUnionVariants(variant)
      : [variant];
  });
}

function collectAssertionErrors(rules: readonly Rule[], value: unknown, interpolated: readonly unknown[], lookupPath: string): readonly string[] {
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
