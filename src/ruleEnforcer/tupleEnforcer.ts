import type { Rule, TupleRule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { ValidatorAssertionError } from '../exceptions';
import { FailedMatchResponse, type VariantMatchResponse } from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';
import type { SpecificRuleset } from './shared';
import { DEEP_LEVELS } from './deepnessTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  irrelevant: DEEP_LEVELS.irrelevant,
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function matchTupleVariants(
  variantCollection: UnionVariantCollection<TupleRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<TupleRule> {
  assert(!variantCollection.isEmpty());
  let curVariantCollection = variantCollection;

  if (!Array.isArray(target)) {
    return curVariantCollection.createFailResponse(
      `Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`,
      { deep: availableDeepLevels().typeCheck },
    );
  }

  const matchSizeResponse = curVariantCollection.matchEach(({ rootRule }) => {
    assertValidTupleSize(rootRule, target, lookupPath);
  }, { deep: availableDeepLevels().immediateInfoCheck });

  curVariantCollection = curVariantCollection.removeFailed(matchSizeResponse);
  if (curVariantCollection.isEmpty()) {
    assert(matchSizeResponse instanceof FailedMatchResponse);
    return matchSizeResponse.asFailedResponseFor(variantCollection);
  }

  for (const [subTargetIndex, subTarget] of target.entries()) {
    // I don't have to worry about required/optional here. Length checks were already done above.
    const derivedCollection = curVariantCollection
      .map(variant => deriveEntryRuleset(variant, subTargetIndex));

    if (derivedCollection.isEmpty()) {
      // This means each variant is validating via "rest".
      // We can break this loop and move onto the "rest" validation step.
      break;
    }

    const matchEntryResponse = matchVariants(
      derivedCollection,
      subTarget,
      `${lookupPath}[${subTargetIndex}]`,
      { deep: availableDeepLevels().recurseInwardsCheck },
    );
    curVariantCollection = curVariantCollection.removeFailed(matchEntryResponse);
    if (curVariantCollection.isEmpty()) {
      assert(matchEntryResponse instanceof FailedMatchResponse);
      return matchEntryResponse.asFailedResponseFor(variantCollection);
    }
  }

  // Validate "rest" rules
  const matchRestResponse = curVariantCollection
    .filter(({ rootRule }) => rootRule.rest !== null)
    .matchEach(({ rootRule, interpolated }) => {
      assert(rootRule.rest !== null);

      const startIndex = rootRule.content.length + rootRule.optionalContent.length;
      const portionToTestAgainst = target.slice(startIndex);

      const subPath = `${lookupPath}.slice(${startIndex})`;
      matchVariants(
        new UnionVariantCollection([{ rootRule: rootRule.rest, interpolated }]),
        portionToTestAgainst,
        subPath,
        { deep: availableDeepLevels().irrelevant },
      ).throwIfFailed();
    }, { deep: availableDeepLevels().recurseInwardsCheck });

  if (curVariantCollection.removeFailed(matchRestResponse).isEmpty()) {
    assert(matchRestResponse instanceof FailedMatchResponse);
    return matchRestResponse.asFailedResponseFor(variantCollection);
  }

  return matchSizeResponse;
}

function assertValidTupleSize(rule: TupleRule, target: unknown[], lookupPath: string): void {
  const minSize = rule.content.length;
  const maxSize = rule.rest !== null
    ? Infinity
    : rule.content.length + rule.optionalContent.length;

  if (target.length < minSize || target.length > maxSize) {
    if (minSize === maxSize) {
      throw new ValidatorAssertionError(
        `Expected the ${lookupPath} array to have ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    } else if (maxSize !== Infinity) {
      throw new ValidatorAssertionError(
        `Expected the ${lookupPath} array to have between ${minSize} and ${maxSize} entries, ` +
        `but found ${target.length}.`,
      );
    } else {
      throw new ValidatorAssertionError(
        `Expected the ${lookupPath} array to have at least ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    }
  }
}

/**
 * Provides a rule for matching a single tuple entry, given the tuple rule and an index.
 */
function deriveEntryRuleset(
  { rootRule, interpolated }: SpecificRuleset<TupleRule>,
  index: number,
): null | SpecificRuleset<Rule> {
  const maybeRequiredEntry = rootRule.content[index];
  if (maybeRequiredEntry !== undefined) {
    return { rootRule: maybeRequiredEntry, interpolated };
  }

  const maybeOptionalEntry = rootRule.optionalContent[index - rootRule.content.length];
  if (maybeOptionalEntry !== undefined) {
    return { rootRule: maybeOptionalEntry, interpolated };
  }

  assert(rootRule.rest !== null);
  return null;
}
