import { strict as assert } from 'node:assert';
import { packagePrivate } from '../packagePrivateAccess';
import {
  type Rule,
  type ArrayRule,
  type InterpolationRule,
  type IntersectionRule,
  type IteratorRule,
  type ObjectRule,
  type PrimitiveLiteralRule,
  type SimpleRule,
  type TupleRule,
  _parsingRulesInternals,
} from '../types/validationRules';
import { matchObjectVariants } from './objectEnforcer';
import { matchTupleVariants } from './tupleEnforcer';
import {
  SuccessMatchResponse,
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  FailedMatchResponse,
} from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { matchArrayVariants } from './arrayEnforcer';
import { buildUnionError, DEEP_LEVELS, getSimpleTypeOf, type SpecificRuleset } from './shared';
import { createValidatorAssertionError } from '../exceptions';
import { reprUnknownValue } from '../util';
import { matchInterpolationVariants, preprocessInterpolatedValue } from './interpolationEnforcer';

const { allCategories } = _parsingRulesInternals[packagePrivate];

/**
 * the `deep` parameter will set the deepness level of whatever failures are returned.
 */
export function matchVariants<RuleType extends Rule>(
  unflattenedVariantCollection: UnionVariantCollection<RuleType>,
  target: unknown,
  lookupPath: string,
  { deep }: { deep: number },
): VariantMatchResponse<RuleType> {
  assert(unflattenedVariantCollection.variants.length > 0);

  const variantCollection = normalizeVariants(unflattenedVariantCollection);

  const groupedVariants = variantCollection.groups(v => v.rootRule.category, { keys: allCategories });

  // We pre-flattened all unions, so there shouldn't be any union rules in here.
  assert(groupedVariants.union.isEmpty());

  const allResponses = [
    groupedVariants.noop.matchEach(variant => { /* no-op */ }, { deep: DEEP_LEVELS.irrelevant }),
    matchSimpleVariants(
      groupedVariants.simple as UnionVariantCollection<SimpleRule>,
      target,
      lookupPath,
    ),
    matchPrimitiveLiteralVariants(
      groupedVariants.primitiveLiteral as UnionVariantCollection<PrimitiveLiteralRule>,
      target,
      lookupPath,
    ),
    matchIntersectionVariants(
      groupedVariants.intersection as UnionVariantCollection<IntersectionRule>,
      target,
      lookupPath,
    ),
    matchIteratorVariants(
      groupedVariants.iterator as UnionVariantCollection<IteratorRule>,
      target,
      lookupPath,
    ),
    matchObjectVariants(
      groupedVariants.object as UnionVariantCollection<ObjectRule>,
      target,
      lookupPath,
    ),
    matchArrayVariants(
      groupedVariants.array as UnionVariantCollection<ArrayRule>,
      target,
      lookupPath,
    ),
    matchTupleVariants(
      groupedVariants.tuple as UnionVariantCollection<TupleRule>,
      target,
      lookupPath,
    ),
    matchInterpolationVariants(
      groupedVariants.interpolation as UnionVariantCollection<InterpolationRule>,
      target,
      lookupPath,
    ),
  ];

  let remainingVariants = variantCollection.asFilteredView();
  for (const response of allResponses) {
    remainingVariants = remainingVariants.removeFailed(response);
  }

  if (remainingVariants.isEmpty()) {
    return mergeFailedOrEmptyResponses<RuleType>(allResponses, unflattenedVariantCollection, { deep });
  } else {
    return mergeMatchResultsToSuccessResult(allResponses) as SuccessMatchResponse<RuleType>;
  }
}

/**
 * Merge responses together.
 * Creates a combined union error message, using only the errors that were
 * associated with the "deepest" failures.
 * The new result will be assigned a deepness level of the provided "deep" parameter.
 */
function mergeFailedOrEmptyResponses<RuleType extends Rule>(
  matchResponses: ReadonlyArray<VariantMatchResponse<Rule>>,
  targetCollection: UnionVariantCollection,
  { deep }: { deep: number },
): FailedMatchResponse<RuleType> {
  const deepestLevel = Math.max(...matchResponses.map(
    response => response instanceof FailedMatchResponse ? response.deep : -Infinity,
  ));

  const errorMessages = matchResponses.flatMap(response => {
    if (response instanceof SuccessMatchResponse) {
      assert(response.failedVariants().length === 0);
      return [];
    } else {
      assert(response instanceof FailedMatchResponse);
      if (response.failedVariants().length === 0) {
        return [];
      }
      if (response.deep < deepestLevel) {
        return [];
      }
      return [response.error.message];
    }
  });

  assert(errorMessages.length > 0);
  return new FailedMatchResponse(buildUnionError(errorMessages), targetCollection, { deep }) as FailedMatchResponse<RuleType>;
}

/** Throws ValidatorAssertionError if the value does not match. */
export function assertMatches<T>(
  rule: SpecificRuleset<Rule>,
  target: T,
  lookupPath: string = '<receivedValue>',
): asserts target is T {
  const variantCollection = new UnionVariantCollection([rule]);
  matchVariants(
    variantCollection,
    target,
    lookupPath,
    { deep: DEEP_LEVELS.irrelevant },
  ).throwIfFailed();
}

/**
 * Flattens nested unions and pulls validators out from interpolation rules (via interpolated validators or refs)
 */
function normalizeVariants(variantCollection: UnionVariantCollection<Rule>): UnionVariantCollection<Rule> {
  let curCollection = variantCollection.flattenUnions();
  while (true) {
    let somethingChanged = false;
    const newCollection = curCollection.map(variant => {
      if (variant.rootRule.category !== 'interpolation') {
        return variant;
      }

      const { updated, ruleset } = preprocessInterpolatedValue(variant as SpecificRuleset<InterpolationRule>);
      somethingChanged ||= updated;
      return ruleset;
    }).flattenUnions();

    if (!somethingChanged) {
      break;
    }
    curCollection = newCollection;
  }

  return curCollection;
}

// --------------------------------------
//   SMALLER VALIDATION UTILITIES
// --------------------------------------

function matchSimpleVariants(
  variants: UnionVariantCollection<SimpleRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<SimpleRule> {
  return variants.matchEach(({ rootRule }) => {
    if (getSimpleTypeOf(target) !== rootRule.type) {
      let whatWasGot = `type "${getSimpleTypeOf(target)}"`;
      if (Array.isArray(target)) {
        whatWasGot = 'an array';
      } else if (target instanceof Function) {
        whatWasGot = 'a function';
      }
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be of type "${rootRule.type}" but got ${whatWasGot}.`,
      );
    }
  }, { deep: DEEP_LEVELS.unorganized });
}

function matchPrimitiveLiteralVariants(
  variants: UnionVariantCollection<PrimitiveLiteralRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<PrimitiveLiteralRule> {
  return variants.matchEach(({ rootRule }) => {
    if (target !== rootRule.value) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be ${reprUnknownValue(rootRule.value)} but got ${reprUnknownValue(target)}.`,
      );
    }
  }, { deep: DEEP_LEVELS.unorganized });
}

function matchIntersectionVariants(
  variants: UnionVariantCollection<IntersectionRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<IntersectionRule> {
  return variants.matchEach(({ rootRule, interpolated }) => {
    for (const requirement of rootRule.variants) {
      assertMatches({ rootRule: requirement, interpolated }, target, lookupPath);
    }
  }, { deep: DEEP_LEVELS.unorganized });
}

function matchIteratorVariants(
  variants: UnionVariantCollection<IteratorRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<IteratorRule> {
  return variants.matchEach(({ rootRule, interpolated }) => {
    assertMatches({ rootRule: rootRule.iterableType, interpolated }, target, lookupPath);

    if (!isIterable(target)) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      );
    }

    let i = 0;
    for (const entry of target) {
      assertMatches({ rootRule: rootRule.entryType, interpolated }, entry, `[...${lookupPath}][${i}]`);
      ++i;
    }
  }, { deep: DEEP_LEVELS.unorganized });
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);
