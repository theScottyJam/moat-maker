import { strict as assert } from 'node:assert';
import type { ArrayRule } from '../types/parsingRules';
import { reprUnknownValue } from '../util';
import { SuccessMatchResponse, FailedMatchResponse, VariantMatchResponse } from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';

export function matchArrayVariants(
  variantCollection: UnionVariantCollection<ArrayRule>,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): VariantMatchResponse<ArrayRule> {
  if (!Array.isArray(target)) {
    return variantCollection.createFailResponse(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
  }

  let curVariantCollection = variantCollection;
  for (const [i, element] of target.entries()) {
    const derivedCollection = curVariantCollection.map(variant => variant.content);
    const matchResult = matchVariants(derivedCollection, element, interpolated, `${lookupPath}[${i}]`);

    curVariantCollection = curVariantCollection.removeFailed(matchResult);
    if (curVariantCollection.isEmpty()) {
      assert(matchResult instanceof FailedMatchResponse);
      return matchResult.asFailedResponseFor(variantCollection);
    }
  }

  return SuccessMatchResponse.createEmpty(variantCollection);
}
