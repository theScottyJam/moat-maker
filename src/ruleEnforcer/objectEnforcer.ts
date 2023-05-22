import type { ObjectRule, ObjectRuleContentValue, ObjectRuleIndexValue, Rule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { DEEP_LEVELS } from './deepnessTools';
import { type MatchResponse, type CheckFnResponse, match } from './ruleMatcherTools';
import { LookupPath } from './LookupPath';
import type { InterpolatedValue } from '../types/validator';

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
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  if (!isObject(target)) {
    return [{
      message: `Expected ${lookupPath.asString()} to be an object but got ${reprUnknownValue(target)}.`,
      lookupPath,
      deep: availableDeepLevels().nonSpecificTypeCheck,
      progress: 0,
    }];
  }

  const objectRuleWithStaticKeys = validateAndApplyDynamicKeys(rule, interpolated);
  const maybeRequiredKeyMessage = assertRequiredKeysArePresent(objectRuleWithStaticKeys, target, lookupPath);
  if (maybeRequiredKeyMessage !== null) {
    return [{
      message: maybeRequiredKeyMessage,
      lookupPath,
      deep: availableDeepLevels().immediateInfoCheck,
      progress: 1,
    }];
  }

  for (const [key, propertyRules] of objectRuleWithStaticKeys.content) {
    if (!(key in target)) {
      // It was an optional key. We've already done checks above
      // to make sure all required keys are present.
      continue;
    }

    for (const propertyRuleInfo of propertyRules) {
      const elementMatchResponse = match(
        propertyRuleInfo.rule,
        (target as any)[key],
        interpolated,
        lookupPath.thenAccessProperty(key),
      );

      if (elementMatchResponse.failed()) {
        return [{
          matchResponse: elementMatchResponse,
          deep: availableDeepLevels().recurseInwardsCheck,
          progress: 2,
        }];
      }
    }
  }

  if (objectRuleWithStaticKeys.index !== null) {
    const indexMatcher = checkIfIndexSignatureIsSatisfied(objectRuleWithStaticKeys.index, target, interpolated, lookupPath);
    if (indexMatcher !== null) {
      return [{
        matchResponse: indexMatcher,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: 2,
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
  interpolated: readonly InterpolatedValue[],
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
  interpolated: readonly InterpolatedValue[],
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

function doesIndexSignatureApplyToProperty(
  indexInfo: ObjectRuleIndexValue,
  propertyKey: string | symbol,
  interpolated: readonly InterpolatedValue[],
): boolean {
  const numericPropertyKey = typeof propertyKey === 'string' ? Number(propertyKey) : NaN;
  return (
    doesMatch(indexInfo.key, propertyKey, interpolated) ||
    // Handles the case where we're matching the key against the `number` rule.
    // The key has to be turned into a number first, before the `number` rule will take it.
    (!isNaN(numericPropertyKey) && doesMatch(indexInfo.key, numericPropertyKey, interpolated))
  );
}

function doesMatch(rule: Rule, target: unknown, interpolated: readonly InterpolatedValue[]): boolean {
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
