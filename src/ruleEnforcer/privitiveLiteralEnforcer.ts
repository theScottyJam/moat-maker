import type { PrimitiveLiteralRule } from '../types/validationRules.js';
import { getSimpleTypeOf } from './shared.js';
import { DEEP_LEVELS } from './deepnessTools.js';
import { reprUnknownValue } from '../util.js';
import type { CheckFnResponse } from './ruleMatcherTools.js';
import type { LookupPath } from './LookupPath.js';
import type { InterpolatedValue } from '../types/validator.js';

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
  interpolated: readonly InterpolatedValue[],
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
