import type { ArrayRule } from '../types/validationRules';
import { reprUnknownValue } from '../util';
import { DEEP_LEVELS } from './deepnessTools';
import { match, type CheckFnResponse } from './ruleMatcherTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function arrayCheck(
  rule: ArrayRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): CheckFnResponse {
  if (!Array.isArray(target)) {
    return [{
      message: `Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`,
      deep: availableDeepLevels().typeCheck,
      progress: -1,
    }];
  }

  for (const [i, element] of target.entries()) {
    const elementMatchResponse = match(rule.content, element, interpolated, `${lookupPath}[${i}]`);

    if (elementMatchResponse.failed()) {
      return [{
        matchResponse: elementMatchResponse,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: i,
      }];
    }
  }

  return [];
}
