import type { SimpleRule } from '../types/validationRules';
import { type VariantMatchResponse } from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { getSimpleTypeOf } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { ValidatorAssertionError } from '../exceptions';
import { assert } from '../util';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
});

export function matchSimpleVariants(
  variantCollection: UnionVariantCollection<SimpleRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<SimpleRule> {
  assert(!variantCollection.isEmpty());
  return variantCollection.matchEach(({ rootRule }) => {
    if (getSimpleTypeOf(target) !== rootRule.type) {
      let whatWasGot = `type "${getSimpleTypeOf(target)}"`;
      if (Array.isArray(target)) {
        whatWasGot = 'an array';
      } else if (target instanceof Function) {
        whatWasGot = 'a function';
      }
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be of type "${rootRule.type}" but got ${whatWasGot}.`,
      );
    }
  }, { deep: availableDeepLevels().typeCheck });
}
