import type { PrimitiveLiteralRule } from '../types/validationRules';
import { getSimpleTypeOf } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { reprUnknownValue } from '../util';
import type { CheckFnResponse } from './ruleMatcherTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
});

export function primitiveLiteralCheck(
  rule: PrimitiveLiteralRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): CheckFnResponse {
  const formatError = (expectedValue: unknown, actualValue: unknown, lookupPath: string): string => {
    return `Expected ${lookupPath} to be ${reprUnknownValue(expectedValue)} but got ${reprUnknownValue(actualValue)}.`;
  };

  if (getSimpleTypeOf(target) !== getSimpleTypeOf(rule.value)) {
    return [{
      message: formatError(rule.value, target, lookupPath),
      deep: availableDeepLevels().typeCheck,
      progress: 1,
    }];
  }

  if (target !== rule.value) {
    return [{
      message: formatError(rule.value, target, lookupPath),
      deep: availableDeepLevels().immediateInfoCheck,
      progress: 2,
    }];
  }

  return [];
}
