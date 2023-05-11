// Everything in here is publicly exported.
// Each interface defined in here is also copy-pasted onto the doc website, to explain
// what shape of data we expect to find in a ruleset.
// See the doc page here: https://thescottyjam.gitbook.io/moat-maker/resources/syntax-reference

import { asOrdinal, FrozenMap } from '../util';
import type { Validator, ValidatorTemplateTag } from './validator';
import { packagePrivate } from '../packagePrivateAccess';
import type { LazyEvaluator } from './LazyEvaluator';
import { getSimpleTypeOf } from '../ruleEnforcer/shared';

export type SimpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';

const allSimpleTypes: SimpleTypeVariant[] = [
  'string', 'number', 'bigint', 'boolean', 'symbol', 'object', 'null', 'undefined',
];

export interface SimpleRule {
  readonly category: 'simple'
  readonly type: SimpleTypeVariant
}

// Note that the "undefined" and "null" values are categorized as a type under SimpleRule,
// not as a literal under PrimitiveLiteralRule.
export interface PrimitiveLiteralRule {
  readonly category: 'primitiveLiteral'
  readonly value: string | number | bigint | boolean
}

export interface NoopRule {
  readonly category: 'noop'
}

export interface ObjectRuleContentValue {
  readonly optional: boolean
  readonly rule: Rule
}

export interface ObjectRuleIndexValue {
  readonly key: Rule
  readonly value: Rule
  readonly label: string
}

export interface ObjectRule {
  readonly category: 'object'
  // We only ever return rules with frozen maps, but we accept rules of type map,
  // which is the reason for this union type.
  readonly content: FrozenMap<string, ObjectRuleContentValue> | Map<string, ObjectRuleContentValue>
  readonly dynamicContent: FrozenMap<number, ObjectRuleContentValue> | Map<number, ObjectRuleContentValue>
  readonly index: ObjectRuleIndexValue | null
}

export interface ArrayRule {
  readonly category: 'array'
  readonly content: Rule
}

export interface TupleRule {
  readonly category: 'tuple'
  readonly content: readonly Rule[]
  readonly optionalContent: readonly Rule[]
  readonly rest: Rule | null
  readonly entryLabels: readonly string[] | null
}

export interface IterableRule {
  readonly category: 'iterable'
  readonly iterableType: Rule
  readonly entryType: Rule
}

export interface UnionRule {
  readonly category: 'union'
  readonly variants: readonly Rule[]
}

export interface IntersectionRule {
  readonly category: 'intersection'
  readonly variants: readonly Rule[]
}

export interface InterpolationRule {
  readonly category: 'interpolation'
  readonly interpolationIndex: number
}

export type Rule = (
  SimpleRule
  | PrimitiveLiteralRule
  | NoopRule
  | ObjectRule
  | ArrayRule
  | TupleRule
  | IterableRule
  | UnionRule
  | IntersectionRule
  | InterpolationRule
);

export interface Ruleset {
  readonly rootRule: Rule
  readonly interpolated: readonly unknown[]
}

function createLazyEvaluator(deriveValidator: (value: unknown) => Validator): LazyEvaluator {
  return {
    [packagePrivate]: { type: 'lazyEvaluator', deriveValidator },
  };
}

function checkDynamicObjectKey(
  interpolationIndex: number,
  interpolated: readonly unknown[],
  { expectationErrorMessage = false }: { expectationErrorMessage?: boolean } = {},
): string | null {
  if (interpolationIndex >= interpolated.length) {
    if (expectationErrorMessage) {
      // Expected it to...
      return `be an in-bounds index into the interpolated array (which is of length ${interpolated.length}).`;
    } else {
      return (
        `The ${asOrdinal(interpolationIndex + 1)} interpolated value corresponds to an out-of-bounds index ` +
        'in the interpolation array.'
      );
    }
  }

  const key = interpolated[interpolationIndex];

  if (!['string', 'symbol', 'number'].includes(typeof key)) {
    if (expectationErrorMessage) {
      return (
        // Expected it to...
        'index into the interpolated array to a valid value. ' +
        'Since this index is for a dynamic object key, the corresponding ' +
        'interpolated value should be of type string, symbol, or number. ' +
        `Got type ${getSimpleTypeOf(key)}.`
      );
    } else {
      return (
        `The ${asOrdinal(interpolationIndex + 1)} interpolated value corresponds to a dynamic object key, ` +
        'and as such, it must be either of type string, symbol, or number. ' +
        `Got type ${getSimpleTypeOf(key)}.`
      );
    }
  }
  return null;
}

function createRuleCheck(validator: ValidatorTemplateTag, interpolated: readonly unknown[]): Validator {
  const expectNonEmptyArray = validator.expectTo(
    value => Array.isArray(value) && value.length > 0 ? null : 'be non-empty.',
  );

  const ruleRef = validator.createRef();

  const simpleTypeVariantCheck = validator`
    'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined'
  `;

  const simpleRuleCheck = validator`{
    category: 'simple'
    type: ${simpleTypeVariantCheck}
  }`;

  const primitiveLiteralRuleCheck = validator`{
    category: 'primitiveLiteral'
    value: string | number | bigint | boolean
  }`;

  const noopRuleCheck = validator`{
    category: 'noop'
  }`;

  const objectRuleContentValueCheck = validator`{
    optional: boolean
    rule: ${ruleRef}
  }`;

  const objectRuleIndexValueCheck = validator`{
    key: ${ruleRef}
    value: ${ruleRef}
    label: string
  }`;

  const andExpectValidDynamicObjectKey = validator.expectTo(interpolationIndex => {
    return checkDynamicObjectKey(interpolationIndex as number, interpolated, { expectationErrorMessage: true });
  });

  const objectRuleCheck = validator`{
    category: 'object'
    content: (${FrozenMap} | ${Map})@<[string, ${objectRuleContentValueCheck}]>
    dynamicContent: (${FrozenMap} | ${Map})@<[
      number & ${andExpectValidDynamicObjectKey},
      ${objectRuleContentValueCheck}
    ]>
    index: ${objectRuleIndexValueCheck} | null
  }`;

  const arrayRuleCheck = validator`{
    category: 'array'
    content: ${ruleRef}
  }`;

  const andExpectProperTupleRule = validator.expectTo(value_ => {
    const value = value_ as TupleRule;
    const allowedLabelCount = value.content.length + value.optionalContent.length + (value.rest !== null ? 1 : 0);
    if (value.entryLabels !== null && value.entryLabels.length !== allowedLabelCount) {
      return `have exactly ${allowedLabelCount} label(s) but found ${value.entryLabels.length}.`;
    }
    return null;
  });

  const tupleRuleCheck = validator`{
    category: 'tuple'
    content: ${ruleRef}[]
    optionalContent: ${ruleRef}[]
    rest: ${ruleRef} | null
    entryLabels: string[] | null
  } & ${andExpectProperTupleRule}`;

  const iterableRuleCheck = validator`{
    category: 'iterable'
    iterableType: ${ruleRef}
    entryType: ${ruleRef}
  }`;

  const unionRuleCheck = validator`{
    category: 'union'
    variants: ${ruleRef}[] & ${expectNonEmptyArray}
  }`;

  const intersectionRuleCheck = validator`{
    category: 'intersection'
    variants: ${ruleRef}[] & ${expectNonEmptyArray}
  }`;

  const interpolationRuleCheck = validator`{
    category: 'interpolation'
    interpolationIndex: number
  }`;

  const ruleCheck = validator`
    ${simpleRuleCheck}
    | ${primitiveLiteralRuleCheck}
    | ${noopRuleCheck}
    | ${objectRuleCheck}
    | ${arrayRuleCheck}
    | ${tupleRuleCheck}
    | ${iterableRuleCheck}
    | ${unionRuleCheck}
    | ${intersectionRuleCheck}
    | ${interpolationRuleCheck}
  `;

  ruleRef.set(ruleCheck);

  return ruleCheck;
}

function createRulesetCheck(validator: ValidatorTemplateTag): Validator {
  const rulesetCheck = validator`
    { interpolated: unknown[] } &
    ${createLazyEvaluator((target_: any) => {
      const target = target_ as { interpolated: unknown[] };
      const interpolated = target.interpolated;
      return validator`{ rootRule: ${createRuleCheck(validator, interpolated)} }`;
    })}
  `;

  return rulesetCheck;
}

export const _validationRulesInternals = {
  [packagePrivate]: { allSimpleTypes, createRulesetCheck, checkDynamicObjectKey },
};
