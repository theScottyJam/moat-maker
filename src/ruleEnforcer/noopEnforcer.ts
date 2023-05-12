import type { LookupPath } from './LookupPath';
import type { NoopRule } from '../types/validationRules';
import type { CheckFnResponse } from './ruleMatcherTools';
import type { InterpolatedValue } from '../types/validator';

// What did you expect?
// This module did have no-op in its name after all :)

export function noopCheck(
  rule: NoopRule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  return [];
}
