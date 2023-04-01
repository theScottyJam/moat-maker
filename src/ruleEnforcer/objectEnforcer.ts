import { strict as assert } from 'node:assert';
import { ObjectRule, ObjectRuleContentValue, ObjectRuleIndexValue, Rule, UnionRule } from '../types/parsingRules';
import { reprUnknownValue } from '../util';
import { createValidatorAssertionError, createValidatorSyntaxError, ValidatorAssertionError } from '../exceptions';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { isIdentifier } from '../tokenStream';
import { getSimpleTypeOf } from './shared';
import { assertMatchesUnion } from './unionEnforcer';

/**
 * Not a real rule, rather, this data was derived from rule data.
 * This type is similar to ObjectRule, but all dynamic keys have been accounted for,
 * and added to this value, as if they were static keys all along.
 */
export interface ObjectRuleWithStaticKeys {
  // In the case of `{ x: 1, [${'x'}]: 2 }`, the key `x` will have multiple values,
  // which is why this maps keys to lists of values.
  readonly content: Map<string | symbol, readonly ObjectRuleContentValue[]>
  readonly index: ObjectRuleIndexValue | null
}

/**
 * This type is similar to ObjectRule, but all dynamic keys have been accounted for,
 * and added to this value, as if they were static keys all along. Also, union variants
 * have been pushed inwards (e.g. `{ x: 1 } | { x: 2 }` becomes `{ x: 1 | 2 }`).
 */
interface ObjectUnionPushedInwards {
  readonly content: Map<string | symbol, UnionRule>
  // Maps references of the original union variants, to the union variants that were
  // "pushed inwards", Once we know which pushed-inward variants have matched, we can use
  // this mapping to take a step back and see if the original variants match as well.
  readonly unpushedVariantRefToPushedVariantRef: Map<ObjectRuleWithStaticKeys, readonly Rule[]>
}

/** A non-readonly version of the union rule. */
interface InProgressUnion {
  category: 'union'
  variants: Rule[]
}

// Object checks happen in two phases, the outward-object-check and the inward-object-check.
// These two phases are bundled together in this function, but union checks will trigger the phases
// separately by themselves.
export function assertMatchesObject(
  rule: ObjectRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  const [ruleWithStaticKeys, targetObj] = assertOutwardObjCheck(rule, target, interpolated, lookupPath);
  assertInwardObjectCheck([ruleWithStaticKeys], targetObj, interpolated, lookupPath);
}

/**
 * Returns a tuple, where the first item is the passed-in rule
 * transformed into a ObjectRuleWithStaticKeys instance, and the second
 * is the received `target` parameter with no changes, except for the
 * fact that it's labels with the type `object` instead of `unknown`.
 */
export function assertOutwardObjCheck(
  rule: ObjectRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): [ObjectRuleWithStaticKeys, object] {
  const ruleWithStaticKeys = validateAndApplyDynamicKeys(rule, interpolated);
  assertIsObject(target, lookupPath);
  assertRequiredKeysArePresent(ruleWithStaticKeys, target, lookupPath);

  if (rule.index !== null) {
    assertIndexSignatureIsSatisfied(rule.index, target, interpolated, lookupPath);
  }

  // Returning `target`, but with the TS type of `object` instead of `unknown`.
  return [ruleWithStaticKeys, target];
}

// inward checks only happen against variants that haven't failed the outward check.
export function assertInwardObjectCheck(
  ruleVariants: readonly ObjectRuleWithStaticKeys[],
  target: object,
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  assert(ruleVariants.length > 0);

  const unionPushedInwards = pushObjectUnionInwards(ruleVariants, interpolated);

  // Do assertions with the pushed-inward union
  const pushedVariantRefsToErrors = new Map<Rule, ValidatorAssertionError>();
  for (const [key, unionRule] of unionPushedInwards.content) {
    if (!(key in target)) {
      continue;
    }

    const { variantRefToError } = assertMatchesUnion(unionRule, (target as any)[key], interpolated, calcSubLookupPath(lookupPath, key));
    mergeMap(pushedVariantRefsToErrors, variantRefToError);
  }

  // Look at the failures from the pushed-inward union, to see if we have a combination of them
  // that are incompatible with the non-pushed union.
  // e.g. `{ x: 2, y: 2 } | { x: 3, y: 3 }` pushed inward would be `{ x: 2 | 3, y: 2 | 3 }`.
  // If we validate `{ x: 2, y: 3 }` against the pushed-inward rule, we won't get any errors thrown,
  // but we do get back what failures happened during the validation, and we can see that the
  // the particular combination of failures (`x` prop not being 3, and `y` prop not being 2) is
  // incompatible with the original, unpushed union.
  const { unpushedVariantRefToPushedVariantRef } = unionPushedInwards;
  const outwardUnionsAreObeyed = ruleVariants.some(unpushedVariant => {
    const matchingPushedVariants = unpushedVariantRefToPushedVariantRef.get(unpushedVariant);

    // Happens if you have a particular outer variant that doesn't get pushed inwards, e.g.
    // the first two variants won't be pushed inwards in `{} | { [index: string]: string } | { x: 2 }`.
    if (matchingPushedVariants === undefined) {
      return true;
    }

    const success = matchingPushedVariants.every(v => !pushedVariantRefsToErrors.has(v));
    return success;
  });

  if (!outwardUnionsAreObeyed) {
    throw createValidatorAssertionError(
      `${lookupPath}'s properties matches various union variants ` +
      'when it needs to pick a single variant to follow.',
    );
  }
}

/**
 * Takes a type like `{ x: number, y: string } | { x: boolean }`
 * and converts to `{ x: number | boolean, y: string }`.
 * Or, an example with index signatures, you can go from
 * `{ [n: number]: boolean } | { 0: string }` to `{ 0: boolean | string }`;
 */
function pushObjectUnionInwards(
  ruleVariants: readonly ObjectRuleWithStaticKeys[],
  interpolated: readonly unknown[],
): ObjectUnionPushedInwards {
  /** Converts stuff like `{ x: A, ['x']: B }` to `{ x: A & B }` */
  function duplicateKeysToIntersection(expectations: readonly ObjectRuleContentValue[]): Rule {
    // The array should have at least one item in it.
    assert(expectations[0] !== undefined);

    return expectations.length === 1
      ? expectations[0].rule
      : {
          category: 'intersection' as const,
          variants: expectations.map(expectation => expectation.rule),
        };
  }

  const emptyUnionRule = (): InProgressUnion => ({ category: 'union' as const, variants: [] });

  const content = new Map<string | symbol, InProgressUnion>();

  // pre-fill the content map, so all keys are present.
  for (const ruleWithStaticKeys of ruleVariants) {
    for (const [key, expectations] of ruleWithStaticKeys.content) {
      if (!content.has(key)) {
        content.set(key, emptyUnionRule());
      }
    }
  }

  const unpushedVariantRefToPushedVariantRef = new Map<ObjectRuleWithStaticKeys, Rule[]>();

  // A portion of this logic is here to help merge index signatures in.
  // Note that full validation of the index signature isn't happening here,
  // This function gets called during the "inward" check process, but separate
  // validation of the index signatures have also happened during the "outward" checks.
  for (const ruleWithStaticKeys of ruleVariants) {
    for (const [key, unionRule] of content) {
      const expectations = [];

      if (ruleWithStaticKeys.content.has(key)) {
        expectations.push(...ruleWithStaticKeys.content.get(key) as ObjectRuleContentValue[]);
      }

      if (
        ruleWithStaticKeys.index !== null &&
        doesIndexSignatureApplyToProperty(ruleWithStaticKeys.index, key, interpolated)
      ) {
        expectations.push({ optional: true, rule: ruleWithStaticKeys.index.value });
      }

      if (expectations.length === 0) {
        continue;
      }

      const inwardVariant = duplicateKeysToIntersection(expectations);
      setDefaultAndGet(unpushedVariantRefToPushedVariantRef, ruleWithStaticKeys, []).push(inwardVariant);
      unionRule.variants.push(inwardVariant);
    }
  }

  return { content, unpushedVariantRefToPushedVariantRef };
}

function assertIsObject(target: unknown, lookupPath: string): asserts target is object {
  if (!isObject(target)) {
    throw createValidatorAssertionError(`Expected ${lookupPath} to be an object but got ${reprUnknownValue(target)}.`);
  }
}

/**
 * Ensures the interpolated dynamic keys are of correct types (strings or symbols),
 * then transforms the data into a more accessible form.
 */
function validateAndApplyDynamicKeys(rule: ObjectRule, interpolated: readonly unknown[]): ObjectRuleWithStaticKeys {
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

  return {
    content,
    index: rule.index,
  };
}

function assertRequiredKeysArePresent(
  ruleWithStaticKeys: ObjectRuleWithStaticKeys,
  target: object,
  lookupPath: string,
): void {
  const missingKeys = [...ruleWithStaticKeys.content.entries()]
    .filter(([key, value]) => !value.every(({ optional }) => optional))
    .filter(([key, value]) => !(key in target))
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw createValidatorAssertionError(
      `${lookupPath} is missing the required properties: ` +
      missingKeys.map(key => reprUnknownValue(key)).join(', '),
    );
  }
}

function assertIndexSignatureIsSatisfied(
  indexInfo: ObjectRuleIndexValue,
  target: object,
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  for (const [key, value] of allObjectEntries(target)) {
    if (doesIndexSignatureApplyToProperty(indexInfo, key, interpolated)) {
      assertMatches(indexInfo.value, value, interpolated, calcSubLookupPath(lookupPath, key));
    }
  }
}

function doesIndexSignatureApplyToProperty(
  indexInfo: ObjectRuleIndexValue,
  propertyKey: string | symbol,
  interpolated: readonly unknown[],
): boolean {
  const numericPropertyKey = typeof propertyKey === 'string' ? Number(propertyKey) : NaN;
  return (
    doesMatch(indexInfo.key, propertyKey, interpolated) ||
    // Handles the case where we're matching the key against the `number` rule.
    // The key has to be turned into a number first, before the `number` rule will take it.
    (!isNaN(numericPropertyKey) && doesMatch(indexInfo.key, numericPropertyKey, interpolated))
  );
}

/** Calculates the next lookup path, given the current lookup path and an object key. */
function calcSubLookupPath(lookupPath: string, key: string | symbol): string {
  if (typeof key === 'string' && isIdentifier(key)) {
    return `${lookupPath}.${key}`;
  } else if (typeof key === 'string') {
    return `${lookupPath}[${JSON.stringify(key)}]`;
  } else {
    return `${lookupPath}[Symbol(${key.description ?? ''})]`;
  }
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

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

const isObject = (value: unknown): value is object => Object(value) === value;

function mergeMap<K, V>(map1: Map<K, V>, map2: Map<K, V>): void {
  for (const [key, value] of map2) {
    map1.set(key, value);
  }
}

function setDefaultAndGet<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }

  return map.get(key) as any;
}
