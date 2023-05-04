import { LookupPath } from '../LookupPath';
import type { Rule } from '../types/validationRules';
import { gatherErrorMessagesFor, match } from './ruleMatcherTools';
import { buildUnionError } from './shared';

export function doesMatch(rule: Rule, target: unknown, interpolated: readonly unknown[]): boolean {
  return !match(rule, target, interpolated, new LookupPath()).failed();
}

/** Throws ValidatorAssertionError if the value does not match. */
export function assertMatches<T>(
  rule: Rule,
  target: T,
  interpolated: readonly unknown[],
  baseLookupPath: string | undefined,
): asserts target is T {
  const matchResponse = match(rule, target, interpolated, new LookupPath(baseLookupPath));
  if (matchResponse.failed()) {
    throw buildUnionError(gatherErrorMessagesFor([matchResponse]));
  }
}
