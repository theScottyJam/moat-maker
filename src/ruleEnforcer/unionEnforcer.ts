// When validating a complex type, we first validate the "outward" information about the type itself,
// then we recurse into the "inward", nested type information.
// This module uses these two terms, "outward" and "inward", to refer to these two steps of validation.
// This distinction is important, because when handling unions, we do all outward validation before recursing inwards.

import { strict as assert } from 'node:assert';
import { Rule, UnionRule } from '../types/parsingRules';
import { indentMultilineString } from '../util';
import { createValidatorAssertionError, ValidatorAssertionError } from '../exceptions';
import { assertMatches } from './ruleEnforcer';
import { assertOutwardObjCheck, assertInwardObjectCheck, ObjectRuleWithStaticKeys } from './objectEnforcer';

/**
 * If all variants fail, an error will be thrown. If only some fail, then
 * this assertion will pass, but the failed variant errors will be returned anyways,
 * in case it's needed for further processing.
 */
export function assertMatchesUnion(
  rule: UnionRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): { variantRefToError: Map<Rule, ValidatorAssertionError> } {
  const unionVariants = flattenUnionVariants(rule);

  // Collect all outward errors, along with intermediate data needed for the next step.
  const variantRefToOutwardError = new Map<Rule, ValidatorAssertionError>();
  const variantRefToProcessedObjectRule = new Map<Rule, ObjectRuleWithStaticKeys>();
  for (const variant of unionVariants) {
    const maybeError = captureValidatorAssertionError(() => {
      if (variant.category === 'object') {
        const [ruleWithStaticKeys] = assertOutwardObjCheck(variant, target, interpolated, lookupPath);
        variantRefToProcessedObjectRule.set(variant, ruleWithStaticKeys);
      } else {
        assertMatches(variant, target, interpolated, lookupPath);
      }
    });

    if (maybeError !== null) {
      variantRefToOutwardError.set(variant, maybeError);
    }
  }

  // assert inward object logic
  if (variantRefToProcessedObjectRule.size > 0) {
    // For variantIndexToProcessedObjectRule to have content, an outward object
    // check would have passed, which means the target is an object.
    assert(isObject(target));

    assertInwardObjectCheck([...variantRefToProcessedObjectRule.values()], target, interpolated, lookupPath);
  }

  // throw an outward union error, if there are no valid variants
  if (variantRefToOutwardError.size === unionVariants.length) {
    throw buildUnionError(unique(
      [...variantRefToOutwardError.values()]
        .map(error => error.message),
    ));
  }

  return { variantRefToError: variantRefToOutwardError };
}

function buildUnionError(variantErrorMessages: readonly string[]): ValidatorAssertionError {
  if (variantErrorMessages.length === 1) {
    assert(variantErrorMessages[0] !== undefined);
    throw createValidatorAssertionError(variantErrorMessages[0]);
  }

  return createValidatorAssertionError(
    'Failed to match against any variant of a union.\n' +
    variantErrorMessages
      .map((message, i) => `  Variant ${i + 1}: ${indentMultilineString(message, 4).slice(4)}`)
      .join('\n'),
  );
}

function captureValidatorAssertionError(fn: () => unknown): ValidatorAssertionError | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof ValidatorAssertionError) {
      return error;
    }
    throw error;
  }
}

function flattenUnionVariants(rule: UnionRule): readonly Rule[] {
  return rule.variants.flatMap(variant => {
    return variant.category === 'union'
      ? flattenUnionVariants(variant)
      : [variant];
  });
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function unique<T>(array: readonly T[]): readonly T[] {
  return [...new Set(array)];
}

const isObject = (value: unknown): value is object => Object(value) === value;
