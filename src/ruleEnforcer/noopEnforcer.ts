import type { LookupPath } from './LookupPath.js';
import type { NoopRule } from '../types/validationRules.js';
import type { CheckFnResponse } from './ruleMatcherTools.js';
import type { InterpolatedValue } from '../types/validator.js';

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
