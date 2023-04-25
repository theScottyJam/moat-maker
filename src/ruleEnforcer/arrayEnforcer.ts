import type { ArrayRule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { SuccessMatchResponse, FailedMatchResponse, type VariantMatchResponse } from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';
import { DEEP_LEVELS } from './deepnessTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function matchArrayVariants(
  variantCollection: UnionVariantCollection<ArrayRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<ArrayRule> {
  assert(!variantCollection.isEmpty());

  if (!Array.isArray(target)) {
    return variantCollection.createFailResponse(
      `Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`,
      { deep: availableDeepLevels().typeCheck },
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
      { deep: availableDeepLevels().recurseInwardsCheck },
    );

    curVariantCollection = curVariantCollection.removeFailed(matchResult);
    if (curVariantCollection.isEmpty()) {
      assert(matchResult instanceof FailedMatchResponse);
      return matchResult.asFailedResponseFor(variantCollection);
    }
  }

  return SuccessMatchResponse.createEmpty(variantCollection);
}
