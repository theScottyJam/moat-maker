import type { PrimitiveLiteralRule } from '../types/validationRules';
import {
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  FailedMatchResponse,
} from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { getSimpleTypeOf } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { ValidatorAssertionError } from '../exceptions';
import { assert, reprUnknownValue } from '../util';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
});

export function matchPrimitiveLiteralVariants(
  variantCollection: UnionVariantCollection<PrimitiveLiteralRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<PrimitiveLiteralRule> {
  assert(!variantCollection.isEmpty());
  let curVariantCollection = variantCollection;

  const formatError = (expectedValue: unknown, actualValue: unknown, lookupPath: string): string => {
    return `Expected ${lookupPath} to be ${reprUnknownValue(expectedValue)} but got ${reprUnknownValue(actualValue)}.`;
  };

  const typeCheckFailures = variantCollection.matchEach(({ rootRule }) => {
    if (getSimpleTypeOf(target) !== getSimpleTypeOf(rootRule.value)) {
      throw new ValidatorAssertionError(formatError(rootRule.value, target, lookupPath));
    }
  }, { deep: availableDeepLevels().typeCheck });

  curVariantCollection = curVariantCollection.removeFailed(typeCheckFailures);
  if (curVariantCollection.isEmpty()) {
    assert(typeCheckFailures instanceof FailedMatchResponse);
    return typeCheckFailures.asFailedResponseFor(variantCollection);
  }

  const valueCheckFailures = curVariantCollection.matchEach(({ rootRule }) => {
    if (target !== rootRule.value) {
      throw new ValidatorAssertionError(formatError(rootRule.value, target, lookupPath));
    }
  }, { deep: availableDeepLevels().immediateInfoCheck });

  curVariantCollection = curVariantCollection.removeFailed(valueCheckFailures);
  if (curVariantCollection.isEmpty()) {
    assert(valueCheckFailures instanceof FailedMatchResponse);
    return valueCheckFailures.asFailedResponseFor(variantCollection);
  }

  return (
    mergeMatchResultsToSuccessResult([typeCheckFailures, valueCheckFailures])
  ) as VariantMatchResponse<PrimitiveLiteralRule>;
}
