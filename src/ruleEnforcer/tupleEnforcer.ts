import { strict as assert } from 'node:assert';
import type { Rule, TupleRule } from '../types/validationRules';
import { reprUnknownValue } from '../util';
import { ValidatorAssertionError } from '../exceptions';
import { SuccessMatchResponse, FailedMatchResponse, type VariantMatchResponse } from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';
import { DEEP_LEVELS, type SpecificRuleset } from './shared';

export function matchTupleVariants(
  variantCollection: UnionVariantCollection<TupleRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<TupleRule> {
  let curVariantCollection = variantCollection;
  if (curVariantCollection.isEmpty()) {
    return SuccessMatchResponse.createEmpty(curVariantCollection);
  }

  if (!Array.isArray(target)) {
    return curVariantCollection.createFailResponse(
      `Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`,
      { deep: DEEP_LEVELS.typeCheck },
    );
  }

  const matchSizeResponse = curVariantCollection.matchEach(({ rootRule }) => {
    assertValidTupleSize(rootRule, target, lookupPath);
  }, { deep: DEEP_LEVELS.immediateInfoCheck });

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
      { deep: DEEP_LEVELS.recurseInwardsCheck },
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
        { deep: DEEP_LEVELS.irrelevant },
      ).throwIfFailed();
    }, { deep: DEEP_LEVELS.recurseInwardsCheck });

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
