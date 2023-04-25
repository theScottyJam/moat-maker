import type { IntersectionRule } from '../types/validationRules';
import {
  SuccessMatchResponse,
  type VariantMatchResponse,
  FailedMatchResponse,
} from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import type { SpecificRuleset } from './shared';
import { getMaxDeepnessLevelOf, maxDeepRange, DEEP_LEVELS, type DeepRange } from './deepnessTools';
import { assert } from '../util';
import { matchVariants } from './unionEnforcer';

export function matchIntersectionVariants(
  variantCollection: UnionVariantCollection<IntersectionRule>,
  target: unknown,
  lookupPath: string,
): ReadonlyArray<VariantMatchResponse<IntersectionRule>> {
  assert(!variantCollection.isEmpty());

  // Match a single intersection, as opposed to a union of intersections
  const matchIntersection = (
    singleVariantCollection: UnionVariantCollection<IntersectionRule>,
  ): VariantMatchResponse<IntersectionRule> => {
    assert(singleVariantCollection.variants.length === 1);
    const { rootRule, interpolated } = singleVariantCollection.variants[0] as SpecificRuleset<IntersectionRule>;
    let currentMaxDeepnessLevel: DeepRange = DEEP_LEVELS.min;
    for (const requirement of rootRule.variants) {
      const matchResponse = matchVariants(
        new UnionVariantCollection([{ rootRule: requirement, interpolated }]),
        target,
        lookupPath,
        { deep: 'INHERIT' },
      );

      if (matchResponse instanceof FailedMatchResponse) {
        return matchResponse.asFailedResponseFor(singleVariantCollection)
          .withMinDeepness(currentMaxDeepnessLevel);
      }
      currentMaxDeepnessLevel = maxDeepRange([currentMaxDeepnessLevel, getMaxDeepnessLevelOf(requirement)]);
    }

    return SuccessMatchResponse.createEmpty(singleVariantCollection);
  };

  const allResponses: Array<VariantMatchResponse<IntersectionRule>> = [];
  for (const singleVariantCollection of variantCollection) {
    allResponses.push(matchIntersection(singleVariantCollection));
  }

  return allResponses;
}
