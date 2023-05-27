import type { LookupPath } from './LookupPath.js';
import type { UnionRule } from '../types/validationRules.js';
import { match, type MatchResponse, type CheckFnResponse } from './ruleMatcherTools.js';
import type { InterpolatedValue } from '../types/validator.js';

export function unionCheck(
  rule: UnionRule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  const matchResponses: MatchResponse[] = [];
  for (const variantRule of rule.variants) {
    const variantMatchResponse = match(variantRule, target, interpolated, lookupPath);
    if (!variantMatchResponse.failed()) {
      return [];
    }
    matchResponses.push(variantMatchResponse);
  }

  return matchResponses.map(resp => ({
    matchResponse: resp,
    deep: 'INHERIT',
  }));
}
