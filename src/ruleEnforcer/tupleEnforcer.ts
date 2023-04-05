import { strict as assert } from 'node:assert';
import type { Rule, TupleRule, UnionRule } from '../types/parsingRules';
import { reprUnknownValue } from '../util';
import { createValidatorAssertionError, ValidatorAssertionError } from '../exceptions';
import { assertMatchesUnion } from './unionEnforcer';
import { assertMatches } from './ruleEnforcer';
import { buildUnionError, captureValidatorAssertionError } from './shared';

/** A non-readonly version of the union rule. */
interface InProgressUnion {
  category: 'union'
  variants: Rule[]
}

export function assertMatchesTuple(
  rule: TupleRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  const targetTutple = assertOutwardTupleCheck(rule, target, lookupPath);
  assertInwardTupleCheck([rule], targetTutple, interpolated, lookupPath);
}

/**
 * Returns the `target` parameter with no changes, except for the
 * fact that it's labels with the type `unknown[]` instead of `unknown`.
 */
export function assertOutwardTupleCheck(
  rule: TupleRule,
  target: unknown,
  lookupPath: string,
): unknown[] {
  if (!Array.isArray(target)) {
    throw createValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
  }

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

  // Returning `target`, but with the TS type of `unknown[]` instead of `unknown`.
  return target;
}

export function assertInwardTupleCheck(
  ruleVariants: readonly TupleRule[],
  target: unknown[],
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  assert(ruleVariants.length > 0);

  let ruleVariantsStillInTheRunning = ruleVariants;
  for (const [subTargetIndex, subTarget] of target.entries()) {
    const pushedVariantRefToUnpushedVariantRef = new Map<Rule, TupleRule>();
    const pushedInwardUnion: InProgressUnion = {
      category: 'union',
      variants: [],
    };

    for (const variant of ruleVariantsStillInTheRunning) {
      const ruleInfo = tupleEntryRuleAt(variant, subTargetIndex);
      assert(ruleInfo.type !== 'outOfRange');
      if (ruleInfo.type === 'rest') continue;

      // I don't have to worry about required/optional here. Length checks
      // were already done during the outward-check stag.
      pushedInwardUnion.variants.push(ruleInfo.rule);
      pushedVariantRefToUnpushedVariantRef.set(ruleInfo.rule, variant);
    }

    if (pushedInwardUnion.variants.length === 0) {
      // This means each variant is validating via "rest".
      // We can break this loop and move onto the "rest" validation step.
      break;
    }

    let maybePushedVariantRefToError: Map<Rule, ValidatorAssertionError> | null = null;
    const maybeMatchUnionError = captureValidatorAssertionError(() => {
      const unionMatchInfo = assertMatchesUnion(pushedInwardUnion, subTarget, interpolated, `${lookupPath}[${subTargetIndex}]`);
      maybePushedVariantRefToError = unionMatchInfo.variantRefToError;
    });

    maybePushedVariantRefToError = maybePushedVariantRefToError as Map<Rule, ValidatorAssertionError> | null;

    if (maybePushedVariantRefToError !== null) {
      const toRemove = new Set(
        [...maybePushedVariantRefToError.keys()]
          .map(pushedRef => pushedVariantRefToUnpushedVariantRef.get(pushedRef)),
      );
      ruleVariantsStillInTheRunning = ruleVariantsStillInTheRunning
        .filter(variant => !toRemove.has(variant));

      // If there were zero left, then assertMatchesUnion() should have thrown an error, instead of returning
      // with success, with a pushedVariantRefToError objects.
      assert(ruleVariantsStillInTheRunning.length !== 0);
    }

    if (maybeMatchUnionError !== null) {
      // Other variants may be in the running if they validate the current `subTarget` by using their "rest" rule
      // (which doesn't get considered until later).
      const areThereOtherVariantsInTheRunning = pushedInwardUnion.variants.length !== ruleVariantsStillInTheRunning.length;
      if (areThereOtherVariantsInTheRunning) {
        const toRemove = new Set(
          pushedInwardUnion.variants.map(v => pushedVariantRefToUnpushedVariantRef.get(v)),
        );
        ruleVariantsStillInTheRunning = ruleVariantsStillInTheRunning
          .filter(variant => !toRemove.has(variant));

        // Break, jumping to the spot that actually validates "rest" rules.
        break;
      } else {
        throw maybeMatchUnionError;
      }
    }
  }

  // Validate "rest" rules

  const variantRefToRestErrors = new Map<Rule, ValidatorAssertionError>();
  for (const variant of ruleVariantsStillInTheRunning) {
    const restRule = variant.rest;
    if (restRule === null) continue;

    const startIndex = variant.content.length + variant.optionalContent.length;
    const portionToTestAgainst = target.slice(startIndex);

    const subPath = `${lookupPath}.slice(${startIndex})`;
    const maybeError = captureValidatorAssertionError(() => {
      assertMatches(restRule, portionToTestAgainst, interpolated, subPath);
    });

    if (maybeError !== null) {
      variantRefToRestErrors.set(variant, maybeError);
    }
  }

  // throw a union error if there are no valid variants
  if (variantRefToRestErrors.size === ruleVariantsStillInTheRunning.length) {
    throw buildUnionError(
      [...variantRefToRestErrors.values()]
        .map(error => error.message),
    );
  }
}

type TupleEntryRuleAtReturn = { rule: Rule, type: 'required' | 'optional' } | { type: 'rest' } | { type: 'outOfRange' };

function tupleEntryRuleAt(rule: TupleRule, index: number): TupleEntryRuleAtReturn {
  const maybeRequiredEntry = rule.content[index];
  if (maybeRequiredEntry !== undefined) {
    return { rule: maybeRequiredEntry, type: 'required' };
  }

  const maybeOptionalEntry = rule.optionalContent[index - rule.content.length];
  if (maybeOptionalEntry !== undefined) {
    return { rule: maybeOptionalEntry, type: 'optional' };
  }

  return { type: rule.rest !== null ? 'rest' : 'outOfRange' };
}
