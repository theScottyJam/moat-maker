import type { ArrayRule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { SuccessMatchResponse, FailedMatchResponse, type VariantMatchResponse } from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';
import { DEEP_LEVELS } from './shared';

export function matchArrayVariants(
  variantCollection: UnionVariantCollection<ArrayRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<ArrayRule> {
  if (variantCollection.isEmpty()) {
    return SuccessMatchResponse.createEmpty(variantCollection);
  }

  if (!Array.isArray(target)) {
    return variantCollection.createFailResponse(
      `Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`,
      { deep: DEEP_LEVELS.typeCheck },
    );
  }

  let curVariantCollection = variantCollection;
  for (const [i, element] of target.entries()) {
    const derivedCollection = curVariantCollection.map(
      ({ rootRule, interpolated }) => ({ rootRule: rootRule.content, interpolated }),
    );
    const matchResult = matchVariants(
      derivedCollection,
      element,
      `${lookupPath}[${i}]`,
      { deep: DEEP_LEVELS.recurseInwardsCheck },
    );

    curVariantCollection = curVariantCollection.removeFailed(matchResult);
    if (curVariantCollection.isEmpty()) {
      assert(matchResult instanceof FailedMatchResponse);
      return matchResult.asFailedResponseFor(variantCollection);
    }
  }

  return SuccessMatchResponse.createEmpty(variantCollection);
}
