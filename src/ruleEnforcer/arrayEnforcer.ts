import type { LookupPath } from './LookupPath.js';
import type { ArrayRule } from '../types/validationRules.js';
import { reprUnknownValue } from '../util.js';
import { DEEP_LEVELS } from './deepnessTools.js';
import { match, type CheckFnResponse } from './ruleMatcherTools.js';
import type { InterpolatedValue } from '../types/validator.js';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function arrayCheck(
  rule: ArrayRule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  if (!Array.isArray(target)) {
    return [{
      message: `Expected ${lookupPath.asString()} to be an array but got ${reprUnknownValue(target)}.`,
      lookupPath,
      deep: availableDeepLevels().typeCheck,
      progress: -1,
    }];
  }

  for (const [i, element] of target.entries()) {
    const elementMatchResponse = match(rule.content, element, interpolated, lookupPath.thenIndexArray(i));

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
