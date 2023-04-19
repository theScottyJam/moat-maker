import { strict as assert } from 'node:assert';
import type { Rule, TupleRule } from '../types/parsingRules';
import { reprUnknownValue } from '../util';
import { createValidatorAssertionError } from '../exceptions';
import { SuccessMatchResponse, FailedMatchResponse, type VariantMatchResponse } from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { matchVariants } from './unionEnforcer';
import { DEEP_LEVELS } from './shared';

export function matchTupleVariants(
  variantCollection: UnionVariantCollection<TupleRule>,
  target: unknown,
  interpolated: readonly unknown[],
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

  const matchSizeResponse = curVariantCollection.matchEach(variant => {
    assertValidTupleSize(variant, target, lookupPath);
  }, { deep: DEEP_LEVELS.immediateInfoCheck });

  curVariantCollection = curVariantCollection.removeFailed(matchSizeResponse);
  if (curVariantCollection.isEmpty()) {
    assert(matchSizeResponse instanceof FailedMatchResponse);
    return matchSizeResponse.asFailedResponseFor(variantCollection);
  }

  for (const [subTargetIndex, subTarget] of target.entries()) {
    // I don't have to worry about required/optional here. Length checks were already done above.
    const derivedCollection = curVariantCollection
      .map(variant => deriveEntryRule(variant, subTargetIndex));

    if (derivedCollection.isEmpty()) {
      // This means each variant is validating via "rest".
      // We can break this loop and move onto the "rest" validation step.
      break;
    }

    const matchEntryResponse = matchVariants(
      derivedCollection,
      subTarget,
      interpolated,
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
    .filter(variant => variant.rest !== null)
    .matchEach(variant => {
      assert(variant.rest !== null);

      const startIndex = variant.content.length + variant.optionalContent.length;
      const portionToTestAgainst = target.slice(startIndex);

      const subPath = `${lookupPath}.slice(${startIndex})`;
      matchVariants(
        new UnionVariantCollection([variant.rest]),
        portionToTestAgainst,
        interpolated,
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
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    } else if (maxSize !== Infinity) {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have between ${minSize} and ${maxSize} entries, ` +
        `but found ${target.length}.`,
      );
    } else {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have at least ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    }
  }
}

/**
 * Provides a rule for matching a single tuple entry, given the tuple rule and an index.
 */
function deriveEntryRule(variant: TupleRule, index: number): null | Rule {
  const maybeRequiredEntry = variant.content[index];
  if (maybeRequiredEntry !== undefined) {
    return maybeRequiredEntry;
  }

  const maybeOptionalEntry = variant.optionalContent[index - variant.content.length];
  if (maybeOptionalEntry !== undefined) {
    return maybeOptionalEntry;
  }

  assert(variant.rest !== null);
  return null;
}
