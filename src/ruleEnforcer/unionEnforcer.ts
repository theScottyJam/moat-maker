// When validating a complex type, we first validate the "outward" information about the type itself,
// then we recurse into the "inward", nested type information.
// This module (and other modules as well) uses these two terms, "outward" and "inward", to refer to these two steps of validation.
// This distinction is important, because when handling unions, we do all outward validation before recursing inwards.

import { strict as assert } from 'node:assert';
import { Rule, TupleRule, UnionRule } from '../types/parsingRules';
import { ValidatorAssertionError } from '../exceptions';
import { assertMatches } from './ruleEnforcer';
import { assertOutwardObjCheck, assertInwardObjectCheck, ObjectRuleWithStaticKeys } from './objectEnforcer';
import { assertOutwardTupleCheck, assertInwardTupleCheck } from './tupleEnforcer';
import { buildUnionError, captureValidatorAssertionError } from './shared';

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
  const processedObjectRules: ObjectRuleWithStaticKeys[] = [];
  const tupleRules: TupleRule[] = [];
  for (const variant of unionVariants) {
    const maybeError = captureValidatorAssertionError(() => {
      if (variant.category === 'object') {
        const [ruleWithStaticKeys] = assertOutwardObjCheck(variant, target, interpolated, lookupPath);
        processedObjectRules.push(ruleWithStaticKeys);
      } else if (variant.category === 'tuple') {
        assertOutwardTupleCheck(variant, target, lookupPath);
        tupleRules.push(variant);
      } else {
        assertMatches(variant, target, interpolated, lookupPath);
      }
    });

    if (maybeError !== null) {
      variantRefToOutwardError.set(variant, maybeError);
    }
  }

  // assert inward object logic
  if (processedObjectRules.length > 0) {
    // For variantIndexToProcessedObjectRule to have content, an outward object
    // check would have passed, which means the target is an object.
    assert(isObject(target));

    assertInwardObjectCheck(processedObjectRules, target, interpolated, lookupPath);
  }

  // assert inward tuple logic
  if (tupleRules.length > 0) {
    // For variantIndexToProcessedObjectRule to have content, an outward object
    // check would have passed, which means the target is an array.
    assert(Array.isArray(target));

    assertInwardTupleCheck(tupleRules, target, interpolated, lookupPath);
  }

  // throw an outward union error if there are no valid variants
  if (variantRefToOutwardError.size === unionVariants.length) {
    throw buildUnionError(
      [...variantRefToOutwardError.values()]
        .map(error => error.message),
    );
  }

  return { variantRefToError: variantRefToOutwardError };
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

const isObject = (value: unknown): value is object => Object(value) === value;
