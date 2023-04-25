import type {
  Rule,
  ArrayRule,
  InterpolationRule,
  IntersectionRule,
  IterableRule,
  ObjectRule,
  PrimitiveLiteralRule,
  SimpleRule,
  TupleRule,
} from '../types/validationRules';
import { matchObjectVariants } from './objectEnforcer';
import { matchTupleVariants } from './tupleEnforcer';
import {
  type SuccessMatchResponse,
  type VariantMatchResponse,
  mergeMatchResultsToSuccessResult,
  mergeFailedOrEmptyResponsesToFailedResponse,
} from './VariantMatchResponse';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { matchArrayVariants } from './arrayEnforcer';
import type { SpecificRuleset } from './shared';
import { DEEP_LEVELS, type DeepRange } from './deepnessTools';
import { matchInterpolationVariants, preprocessInterpolatedValue } from './interpolationEnforcer';
import { matchIterableVariants } from './iterableEnforcer';
import { matchIntersectionVariants } from './intersectionEnforcer';
import { matchPrimitiveLiteralVariants } from './privitiveLiteralEnforcer';
import { matchSimpleVariants } from './simpleEnforcer';
import { assert } from '../util';

/**
 * the `deep` parameter will set the deepness level of whatever failures are returned.
 * You can only set `deep` to 'INHERIT` if you pass in exactly one variant. 'INHERIT' will
 * preserve the deepness level of whatever the rule matches against.
 */
export function matchVariants<RuleType extends Rule>(
  unflattenedVariantCollection: UnionVariantCollection<RuleType>,
  target: unknown,
  lookupPath: string,
  { deep }: { deep: DeepRange | 'INHERIT' },
): VariantMatchResponse<RuleType> {
  assert(!unflattenedVariantCollection.isEmpty());
  if (deep === 'INHERIT') {
    assert(unflattenedVariantCollection.variants.length === 1);
  }
  const variantCollection = normalizeVariants(unflattenedVariantCollection);

  const groupedVariants = variantCollection.groups(v => v.rootRule.category);

  // We pre-flattened all unions, so there shouldn't be any union rules in here.
  assert(groupedVariants.union === undefined);

  const allResponses = [
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    groupedVariants.noop !== undefined && groupedVariants.noop.matchEach(
      variant => { /* no-op */ }, { deep: DEEP_LEVELS.irrelevant },
    ),
    groupedVariants.simple !== undefined && matchSimpleVariants(
      groupedVariants.simple as UnionVariantCollection<SimpleRule>,
      target,
      lookupPath,
    ),
    groupedVariants.primitiveLiteral !== undefined && matchPrimitiveLiteralVariants(
      groupedVariants.primitiveLiteral as UnionVariantCollection<PrimitiveLiteralRule>,
      target,
      lookupPath,
    ),
    ...(groupedVariants.intersection === undefined
      ? []
      : matchIntersectionVariants(
        groupedVariants.intersection as UnionVariantCollection<IntersectionRule>,
        target,
        lookupPath,
      )
    ),
    groupedVariants.iterable !== undefined && matchIterableVariants(
      groupedVariants.iterable as UnionVariantCollection<IterableRule>,
      target,
      lookupPath,
    ),
    groupedVariants.object !== undefined && matchObjectVariants(
      groupedVariants.object as UnionVariantCollection<ObjectRule>,
      target,
      lookupPath,
    ),
    groupedVariants.array !== undefined && matchArrayVariants(
      groupedVariants.array as UnionVariantCollection<ArrayRule>,
      target,
      lookupPath,
    ),
    groupedVariants.tuple !== undefined && matchTupleVariants(
      groupedVariants.tuple as UnionVariantCollection<TupleRule>,
      target,
      lookupPath,
    ),
    groupedVariants.interpolation !== undefined && matchInterpolationVariants(
      groupedVariants.interpolation as UnionVariantCollection<InterpolationRule>,
      target,
      lookupPath,
    ),
  ].filter(value => value !== false) as ReadonlyArray<VariantMatchResponse<Rule>>;

  let remainingVariants = variantCollection.asFilteredView();
  for (const response of allResponses) {
    remainingVariants = remainingVariants.removeFailed(response);
  }

  if (remainingVariants.isEmpty() && deep === 'INHERIT') {
    assert(allResponses.length === 1);
    return allResponses[0] as VariantMatchResponse<RuleType>;
  } else if (remainingVariants.isEmpty()) {
    assert(deep !== 'INHERIT');
    return mergeFailedOrEmptyResponsesToFailedResponse<RuleType>(allResponses, unflattenedVariantCollection, { deep });
  } else {
    return mergeMatchResultsToSuccessResult(allResponses) as SuccessMatchResponse<RuleType>;
  }
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
