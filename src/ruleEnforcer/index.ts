import type { Rule } from '../types/parsingRules';
import { matchVariants } from './unionEnforcer';
import { DEEP_LEVELS } from './shared';
import { UnionVariantCollection } from './UnionVariantCollection';
import { SuccessMatchResponse } from './VariantMatchResponse';

export function doesMatch(rule: Rule, target: unknown, interpolated: readonly unknown[]): boolean {
  const variantCollection = new UnionVariantCollection([rule]);
  return matchVariants(
    variantCollection,
    target,
    interpolated,
    '<receivedValue>',
    { deep: DEEP_LEVELS.irrelevant },
  ) instanceof SuccessMatchResponse;
}

/** Throws ValidatorAssertionError if the value does not match. */
export function assertMatches<T>(
  rule: Rule,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string = '<receivedValue>',
): asserts target is T {
  const variantCollection = new UnionVariantCollection([rule]);
  matchVariants(
    variantCollection,
    target,
    interpolated,
    lookupPath,
    { deep: DEEP_LEVELS.irrelevant },
  ).throwIfFailed();
}
