import type { PrimitiveLiteralRule } from '../types/validationRules';
import { getSimpleTypeOf } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { reprUnknownValue } from '../util';
import type { CheckFnResponse } from './ruleMatcherTools';
import type { LookupPath } from './LookupPath';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
});

/** An export of the comparison function used internally.
 * (Which, in this case, is just a simple `===`).
 */
export function comparePrimitiveLiterals(a: unknown, b: unknown): boolean {
  return a === b;
}

export function primitiveLiteralCheck(
  rule: PrimitiveLiteralRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: LookupPath,
): CheckFnResponse {
  const formatError = (expectedValue: unknown, actualValue: unknown, lookupPath: LookupPath): string => {
    return (
      `Expected ${lookupPath.asString()} to be ${reprUnknownValue(expectedValue)} ` +
      `but got ${reprUnknownValue(actualValue)}.`
    );
  };

  if (getSimpleTypeOf(target) !== getSimpleTypeOf(rule.value)) {
    return [{
      message: formatError(rule.value, target, lookupPath),
      lookupPath,
      deep: availableDeepLevels().typeCheck,
      progress: 1,
    }];
  }

  if (!comparePrimitiveLiterals(target, rule.value)) {
    return [{
      message: formatError(rule.value, target, lookupPath),
      lookupPath,
      deep: availableDeepLevels().immediateInfoCheck,
      progress: 2,
    }];
  }

  return [];
}
