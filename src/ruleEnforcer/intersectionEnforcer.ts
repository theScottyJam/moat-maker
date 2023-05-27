import type { LookupPath } from './LookupPath.js';
import type { IntersectionRule } from '../types/validationRules.js';
import { getMaxDeepnessLevelOf, maxDeepRange, DEEP_LEVELS, type DeepRange } from './deepnessTools.js';
import { calcCheckResponseDeepness, match, type CheckFnResponse } from './ruleMatcherTools.js';
import type { InterpolatedValue } from '../types/validator.js';

export function intersectionCheck(
  rule: IntersectionRule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  let currentMaxDeepnessLevel: DeepRange = DEEP_LEVELS.min;
  for (const requirement of rule.variants) {
    const requirementMatchResponse = match(requirement, target, interpolated, lookupPath);

    if (requirementMatchResponse.failed()) {
      return [{
        matchResponse: requirementMatchResponse,
        deep: maxDeepRange([
          currentMaxDeepnessLevel,
          ...requirementMatchResponse.failures.flatMap(resp => calcCheckResponseDeepness(resp)),
        ]),
      }];
    }

    currentMaxDeepnessLevel = maxDeepRange([currentMaxDeepnessLevel, getMaxDeepnessLevelOf(requirement)]);
  }

  return [];
}
