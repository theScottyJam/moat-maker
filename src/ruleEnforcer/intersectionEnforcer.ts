import type { LookupPath } from './LookupPath';
import type { IntersectionRule } from '../types/validationRules';
import { getMaxDeepnessLevelOf, maxDeepRange, DEEP_LEVELS, type DeepRange } from './deepnessTools';
import { calcCheckResponseDeepness, match, type CheckFnResponse } from './ruleMatcherTools';

export function intersectionCheck(
  rule: IntersectionRule,
  target: unknown,
  interpolated: readonly unknown[],
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
