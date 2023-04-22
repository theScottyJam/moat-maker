import { type IterableRule, _parsingRulesInternals } from '../types/validationRules';
import {
  SuccessMatchResponse,
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  FailedMatchResponse,
} from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { DEEP_LEVELS } from './shared';
import { assert } from '../util';
import { matchVariants } from './unionEnforcer';

export function matchIterableVariants(
  variantCollection: UnionVariantCollection<IterableRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<IterableRule> {
  let curVariantCollection = variantCollection;
  if (curVariantCollection.isEmpty()) {
    return SuccessMatchResponse.createEmpty(curVariantCollection);
  }
  const allResults: Array<VariantMatchResponse<IterableRule>> = [];

  if (!isIterable(target)) {
    return variantCollection.createFailResponse(
      `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      { deep: DEEP_LEVELS.typeCheck },
    );
  }

  const iterableTypeResult = matchVariants(
    curVariantCollection.map(({ rootRule, interpolated }) => ({ rootRule: rootRule.iterableType, interpolated })),
    target,
    lookupPath,
    { deep: DEEP_LEVELS.immediateInfoCheck },
  );
  allResults.push(iterableTypeResult as VariantMatchResponse<IterableRule>);
  curVariantCollection = curVariantCollection.removeFailed(iterableTypeResult);
  if (curVariantCollection.isEmpty()) {
    assert(iterableTypeResult instanceof FailedMatchResponse);
    return iterableTypeResult.asFailedResponseFor(variantCollection);
  }

  let i = 0;
  for (const entry of target) {
    const contentResults = matchVariants(
      curVariantCollection.map(({ rootRule, interpolated }) => ({ rootRule: rootRule.entryType, interpolated })),
      entry,
      `[...${lookupPath}][${i}]`,
      { deep: DEEP_LEVELS.recurseInwardsCheck },
    );

    allResults.push(contentResults as VariantMatchResponse<IterableRule>);
    curVariantCollection = curVariantCollection.removeFailed(contentResults);
    if (curVariantCollection.isEmpty()) {
      assert(contentResults instanceof FailedMatchResponse);
      return contentResults.asFailedResponseFor(variantCollection);
    }

    ++i;
  }

  return mergeMatchResultsToSuccessResult(allResults) as VariantMatchResponse<IterableRule>;
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);
