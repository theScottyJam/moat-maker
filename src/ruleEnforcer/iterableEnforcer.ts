import { type IterableRule, _parsingRulesInternals } from '../types/validationRules';
import {
  SuccessMatchResponse,
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  FailedMatchResponse,
} from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { DEEP_LEVELS } from './deepnessTools';
import { assert } from '../util';
import { matchVariants } from './unionEnforcer';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function matchIterableVariants(
  variantCollection: UnionVariantCollection<IterableRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<IterableRule> {
  assert(!variantCollection.isEmpty());
  let curVariantCollection = variantCollection;
  const allResults: Array<VariantMatchResponse<IterableRule>> = [];

  if (!isIterable(target)) {
    return variantCollection.createFailResponse(
      `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      { deep: availableDeepLevels().typeCheck },
    );
  }

  const iterableTypeResult = matchVariants(
    curVariantCollection.map(({ rootRule, interpolated }) => ({ rootRule: rootRule.iterableType, interpolated })),
    target,
    lookupPath,
    { deep: availableDeepLevels().immediateInfoCheck },
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
      { deep: availableDeepLevels().recurseInwardsCheck },
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
