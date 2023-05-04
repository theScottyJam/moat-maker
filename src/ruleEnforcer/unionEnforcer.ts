import type { LookupPath } from '../LookupPath';
import type { UnionRule } from '../types/validationRules';
import { match, type MatchResponse, type CheckFnResponse } from './ruleMatcherTools';

export function unionCheck(
  rule: UnionRule,
  target: unknown,
  interpolated: readonly unknown[],
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
