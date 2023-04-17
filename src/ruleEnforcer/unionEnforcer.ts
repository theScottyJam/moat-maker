import { strict as assert } from 'node:assert';
import type { ArrayRule, ObjectRule, Rule, TupleRule } from '../types/parsingRules';
import { assertMatches } from './ruleEnforcer';
import { matchObjectVariants } from './objectEnforcer';
import { matchTupleVariants } from './tupleEnforcer';
import {
  SuccessMatchResponse,
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  FailedMatchResponse,
} from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { matchArrayVariants } from './arrayEnforcer';
import { buildUnionError, DEEP_LEVELS } from './shared';

/**
 * the `deep` parameter will set the deepness level of whatever failures are returned.
 */
export function matchVariants<RuleType extends Rule>(
  unflattenedVariantCollection: UnionVariantCollection<RuleType>,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
  { deep }: { deep: number },
): VariantMatchResponse<RuleType> {
  assert(unflattenedVariantCollection.variants.length > 0);

  const variantCollection = unflattenedVariantCollection.flattenUnions();

  const groupedVariants = variantCollection.groups(
    v => ['object', 'tuple', 'array'].includes(v.category) ? v.category : 'other',
    { keys: ['object', 'tuple', 'array', 'other'] },
  );

  const allResponses = [
    groupedVariants.other.matchEach(variant => {
      assertMatches(variant, target, interpolated, lookupPath);
    }, { deep: DEEP_LEVELS.unorganized }),
    matchObjectVariants(
      groupedVariants.object as UnionVariantCollection<ObjectRule>,
      target,
      interpolated,
      lookupPath,
    ),
    matchArrayVariants(
      groupedVariants.array as UnionVariantCollection<ArrayRule>,
      target,
      interpolated,
      lookupPath,
    ),
    matchTupleVariants(
      groupedVariants.tuple as UnionVariantCollection<TupleRule>,
      target,
      interpolated,
      lookupPath,
    ),
  ];

  let remainingVariants = variantCollection.asFilteredView();
  for (const response of allResponses) {
    remainingVariants = remainingVariants.removeFailed(response);
  }

  if (remainingVariants.isEmpty()) {
    return mergeFailedOrEmptyResponses<RuleType>(allResponses, unflattenedVariantCollection, { deep });
  } else {
    return mergeMatchResultsToSuccessResult(allResponses) as SuccessMatchResponse<RuleType>;
  }
}

/**
 * Merge responses together.
 * Creates a combined union error message, using only the errors that were
 * associated with the "deepest" failures.
 * The new result will be assigned a deepness level of the provided "deep" parameter.
 */
function mergeFailedOrEmptyResponses<RuleType extends Rule>(
  matchResponses: ReadonlyArray<VariantMatchResponse<Rule>>,
  targetCollection: UnionVariantCollection,
  { deep }: { deep: number },
): FailedMatchResponse<RuleType> {
  const deepestLevel = Math.max(...matchResponses.map(
    response => response instanceof FailedMatchResponse ? response.deep : -Infinity,
  ));

  const errorMessages = matchResponses.flatMap(response => {
    if (response instanceof SuccessMatchResponse) {
      assert(response.failedVariants().length === 0);
      return [];
    } else {
      assert(response instanceof FailedMatchResponse);
      if (response.failedVariants().length === 0) {
        return [];
      }
      if (response.deep < deepestLevel) {
        return [];
      }
      return [response.error.message];
    }
  });

  assert(errorMessages.length > 0);
  return new FailedMatchResponse(buildUnionError(errorMessages), targetCollection, { deep }) as FailedMatchResponse<RuleType>;
}
