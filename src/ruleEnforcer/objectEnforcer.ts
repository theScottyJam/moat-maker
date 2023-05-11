import type { ObjectRule, ObjectRuleContentValue, ObjectRuleIndexValue, Rule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { DEEP_LEVELS } from './deepnessTools';
import { type MatchResponse, type CheckFnResponse, match } from './ruleMatcherTools';
import { LookupPath } from './LookupPath';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  nonSpecificTypeCheck: DEEP_LEVELS.nonSpecificTypeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

/**
 * Not a real rule,
 * rather, this data was derived from rule data.
 * This type is similar to ObjectRule, but all dynamic keys have been accounted for,
 * and added to this value, as if they were static keys all along.
 */
export interface ObjectRuleWithStaticKeys {
  // In the case of `{ x: 1, [${'x'}]: 2 }`, the key `x` will have multiple values,
  // which is why this maps keys to lists of values.
  readonly content: Map<string | symbol, readonly ObjectRuleContentValue[]>
  readonly index: ObjectRuleIndexValue | null
}

export function objectCheck(
  rule: ObjectRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: LookupPath,
): CheckFnResponse {
  if (!isObject(target)) {
    return [{
      message: `Expected ${lookupPath.asString()} to be an object but got ${reprUnknownValue(target)}.`,
      lookupPath,
      deep: availableDeepLevels().nonSpecificTypeCheck,
      progress: -3,
    }];
  }

  const objectRuleWithStaticKeys = validateAndApplyDynamicKeys(rule, interpolated);
  const maybeRequiredKeyMessage = assertRequiredKeysArePresent(objectRuleWithStaticKeys, target, lookupPath);
  if (maybeRequiredKeyMessage !== null) {
    return [{
      message: maybeRequiredKeyMessage,
      lookupPath,
      deep: availableDeepLevels().immediateInfoCheck,
      progress: -2,
    }];
  }

  // TODO: Merge the responses from failed index checks and other failed property value checks.
  // One shouldn't take precedence over the other.
  // i.e. give them the same progress number.

  if (rule.index !== null) {
    const indexMatcher = checkIfIndexSignatureIsSatisfied(rule.index, target, interpolated, lookupPath);
    if (indexMatcher !== null) {
      return [{
        matchResponse: indexMatcher,
        deep: availableDeepLevels().immediateInfoCheck,
        progress: -1,
      }];
    }
  }

  // TODO: When an index type isn't being used, looping through each property like this isn't the most performant option.
  for (const [key, propertyValue] of allObjectEntries(target)) {
    const propertyRule = derivePropertyRule(objectRuleWithStaticKeys, key, interpolated);
    if (propertyRule === null) {
      continue;
    }

    const elementMatchResponse = match(
      propertyRule,
      propertyValue,
      interpolated,
      lookupPath.thenAccessProperty(key),
    );

    if (elementMatchResponse.failed()) {
      return [{
        matchResponse: elementMatchResponse,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: 0,
      }];
    }
  }

  return [];
}

/**
 * Ensures the interpolated dynamic keys are of correct types (strings or symbols),
 * then transforms the data into a more accessible form.
 */
function validateAndApplyDynamicKeys(
  rule: ObjectRule,
  interpolated: readonly unknown[],
): ObjectRuleWithStaticKeys {
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

    assert(typeof key === 'string' || typeof key === 'symbol');

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
  lookupPath: LookupPath,
): string | null {
  const missingKeys = [...ruleWithStaticKeys.content.entries()]
    .filter(([key, value]) => !value.every(({ optional }) => optional))
    .filter(([key, value]) => !(key in target))
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    return (
      `${lookupPath.asString()} is missing the required properties: ` +
      missingKeys.map(key => reprUnknownValue(key)).join(', ')
    );
  }

  return null;
}

function checkIfIndexSignatureIsSatisfied(
  indexInfo: ObjectRuleIndexValue,
  target: object,
  interpolated: readonly unknown[],
  lookupPath: LookupPath,
): MatchResponse | null {
  for (const [key, value] of allObjectEntries(target)) {
    if (doesIndexSignatureApplyToProperty(indexInfo, key, interpolated)) {
      const matchResponse = match(
        indexInfo.value,
        value,
        interpolated,
        lookupPath.thenAccessProperty(key),
      );

      if (matchResponse.failed()) {
        return matchResponse;
      }
    }
  }

  return null;
}

/**
 * Takes a type like `{ x: number, y: string } | { x: boolean }`
 * and a property name like "x", and returns all variants that it must
 * conform to, like `number | boolean`.
 * Or, an example with index signatures, you can go from
 * `{ [n: number]: boolean } | { 0: string }` with the property `0`
 * to `boolean | string`;
 */
function derivePropertyRule(
  ruleWithStaticKeys: ObjectRuleWithStaticKeys,
  key: string | symbol,
  interpolated: readonly unknown[],
): null | Rule {
  const intersectionRules = [];

  // Helps to convert stuff like `{ x: A, ['x']: B }` to `{ x: A & B }`
  const duplicateKeysToIntersection = (intersectionRules: readonly ObjectRuleContentValue[]): Rule => {
    // The array should have at least one item in it.
    assert(intersectionRules[0] !== undefined);

    return intersectionRules.length === 1
      ? intersectionRules[0].rule
      : {
          category: 'intersection' as const,
          variants: intersectionRules.map(expectation => expectation.rule),
        };
  };

  if (ruleWithStaticKeys.content.has(key)) {
    intersectionRules.push(...ruleWithStaticKeys.content.get(key) as ObjectRuleContentValue[]);
  }

  if (
    ruleWithStaticKeys.index !== null &&
    doesIndexSignatureApplyToProperty(ruleWithStaticKeys.index, key, interpolated)
  ) {
    intersectionRules.push({ optional: true, rule: ruleWithStaticKeys.index.value });
  }

  if (intersectionRules.length === 0) {
    return null;
  }

  return duplicateKeysToIntersection(intersectionRules);
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

function doesMatch(rule: Rule, target: unknown, interpolated: readonly unknown[]): boolean {
  return !match(rule, target, interpolated, new LookupPath()).failed();
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
