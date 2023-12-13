// Everything in here is publicly exported.
// Each interface defined in here is also copy-pasted onto the doc website, to explain
// what shape of data we expect to find in a ruleset.
// See the doc page here: https://thescottyjam.gitbook.io/moat-maker/resources/syntax-reference

import { asOrdinal, FrozenMap, reprUnknownValue } from '../util.js';
import {
  type InterpolatedValue,
  type Validator,
  type ValidatorTemplateTag,
  type LazyEvaluator,
  createInterpolatedValueCheck,
} from './validator.js';
import { packagePrivate } from '../packagePrivateAccess.js';
import { expectDirectInstanceFactory, expectKeysFromFactory, expectNonSparseFactory } from '../validationHelpers.js';

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

export interface PropertyRuleContentValue {
  readonly optional: boolean
  readonly rule: Rule
}

export interface PropertyRuleIndexValue {
  readonly key: Rule
  readonly value: Rule
  readonly label: string
}

export interface PropertyRule {
  readonly category: 'property'
  // We only ever return rules with frozen maps, but we accept rules of type map,
  // which is the reason for this union type.
  readonly content: FrozenMap<string, PropertyRuleContentValue> | Map<string, PropertyRuleContentValue>
  readonly dynamicContent: FrozenMap<number, PropertyRuleContentValue> | Map<number, PropertyRuleContentValue>
  readonly index: PropertyRuleIndexValue | null
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
  | PropertyRule
  | ArrayRule
  | TupleRule
  | IterableRule
  | UnionRule
  | IntersectionRule
  | InterpolationRule
);

export interface Ruleset {
  readonly rootRule: Rule
  readonly interpolated: readonly InterpolatedValue[]
}

function createLazyEvaluator(deriveValidator: (value: unknown) => Validator): LazyEvaluator {
  return {
    [packagePrivate]: { type: 'lazyEvaluator', deriveValidator },
  };
}

function checkDynamicPropertyName(
  interpolationIndex: number,
  interpolated: readonly InterpolatedValue[],
  { expectationErrorMessage = false }: { expectationErrorMessage?: boolean } = {},
): string | undefined {
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
        'Since this index is for a dynamic property name, the corresponding ' +
        'interpolated value should be of type string, symbol, or number. ' +
        `Got ${reprUnknownValue(key)}.`
      );
    } else {
      return (
        `The ${asOrdinal(interpolationIndex + 1)} interpolated value corresponds to a dynamic property name, ` +
        'and as such, it must be either of type string, symbol, or number. ' +
        `Got ${reprUnknownValue(key)}.`
      );
    }
  }
  return undefined;
}

function createRuleCheck(validator: ValidatorTemplateTag, interpolated: readonly InterpolatedValue[]): Validator {
  const expectDirectInstance = expectDirectInstanceFactory(validator);
  const expectKeysFrom = expectKeysFromFactory(validator);
  const expectNonSparse = expectNonSparseFactory(validator);
  const expectNormalArray = validator`${expectDirectInstance(Array)} & ${expectNonSparse}`;
  const andExpectNonEmptyArray = validator.expectTo<unknown[]>(
    value => value.length > 0 ? undefined : 'be non-empty.',
  );

  const lazyRuleCheck = validator.lazy(() => ruleCheck);

  const simpleTypeVariantCheck = validator`
    'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined'
  `;

  const simpleRuleCheck = validator`{
    category: 'simple'
    type: ${simpleTypeVariantCheck}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'type'])}`;

  const andExpectNotNaN = validator.expectTo<number>(value => Number.isNaN(value) ? 'not be NaN.' : undefined);
  const andExpectNotInfinity = validator.expectTo<number>(value => !Number.isFinite(value) ? 'be finite.' : undefined);

  const primitiveLiteralRuleCheck = validator`{
    category: 'primitiveLiteral'
    value: string | bigint | boolean | (
      number & ${andExpectNotNaN} & ${andExpectNotInfinity}
    )
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'value'])}`;

  const noopRuleCheck = validator`{
    category: 'noop'
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category'])}`;

  const propertyRuleContentValueCheck = validator`{
    optional: boolean
    rule: ${lazyRuleCheck}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['optional', 'rule'])}`;

  const propertyRuleIndexValueCheck = validator`{
    key: ${lazyRuleCheck}
    value: ${lazyRuleCheck}
    label: string
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['key', 'value', 'label'])}`;

  const andExpectValidDynamicPropertyName = validator.expectTo(interpolationIndex => {
    return checkDynamicPropertyName(interpolationIndex as number, interpolated, { expectationErrorMessage: true });
  });

  const propertyRuleCheck = validator`{
    category: 'property'
    content: (${expectDirectInstance(FrozenMap)} | ${expectDirectInstance(Map)})@<[
      string,
      ${propertyRuleContentValueCheck}
    ]>
    dynamicContent: (${expectDirectInstance(FrozenMap)} | ${expectDirectInstance(Map)})@<[
      number & ${andExpectValidDynamicPropertyName},
      ${propertyRuleContentValueCheck}
    ]>
    index: ${propertyRuleIndexValueCheck} | null
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'content', 'dynamicContent', 'index'])}`;

  const arrayRuleCheck = validator`{
    category: 'array'
    content: ${lazyRuleCheck}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'content'])}`;

  const andExpectProperTupleRule = validator.expectTo<TupleRule>(value => {
    const allowedLabelCount = value.content.length + value.optionalContent.length + (value.rest !== null ? 1 : 0);
    if (value.entryLabels !== null && value.entryLabels.length !== allowedLabelCount) {
      return `have exactly ${allowedLabelCount} label(s) but found ${value.entryLabels.length}.`;
    }
    return undefined;
  });

  const tupleRuleCheck = validator`{
    category: 'tuple'
    content: ${lazyRuleCheck}[] & ${expectNormalArray}
    optionalContent: ${lazyRuleCheck}[] & ${expectNormalArray}
    rest: ${lazyRuleCheck} | null
    entryLabels: (string[] & ${expectNormalArray}) | null
  } & ${andExpectProperTupleRule}
    & ${expectDirectInstance(Object)}
    & ${expectKeysFrom(['category', 'content', 'optionalContent', 'rest', 'entryLabels'])}`;

  const iterableRuleCheck = validator`{
    category: 'iterable'
    iterableType: ${lazyRuleCheck}
    entryType: ${lazyRuleCheck}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'iterableType', 'entryType'])}`;

  const unionRuleCheck = validator`{
    category: 'union'
    variants: ${lazyRuleCheck}[] & ${andExpectNonEmptyArray} & ${expectNormalArray}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'variants'])}`;

  const intersectionRuleCheck = validator`{
    category: 'intersection'
    variants: ${lazyRuleCheck}[] & ${andExpectNonEmptyArray} & ${expectNormalArray}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'variants'])}`;

  const andExpectValidInterpolationIndex = validator.expectTo<number>(index => {
    return index in interpolated
      ? undefined
      : `be an in-bounds interpolation index. Received ${interpolated.length} interpolated value(s).`;
  });

  const interpolationRuleCheck = validator`{
    category: 'interpolation'
    interpolationIndex: number & ${andExpectValidInterpolationIndex}
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['category', 'interpolationIndex'])}`;

  const ruleCheck = validator`
    ${simpleRuleCheck}
    | ${primitiveLiteralRuleCheck}
    | ${noopRuleCheck}
    | ${propertyRuleCheck}
    | ${arrayRuleCheck}
    | ${tupleRuleCheck}
    | ${iterableRuleCheck}
    | ${unionRuleCheck}
    | ${intersectionRuleCheck}
    | ${interpolationRuleCheck}
  `;

  return ruleCheck;
}

function createRulesetCheck(validator: ValidatorTemplateTag): Validator {
  const expectDirectInstance = expectDirectInstanceFactory(validator);
  const expectKeysFrom = expectKeysFromFactory(validator);
  const expectNonSparse = expectNonSparseFactory(validator);
  const interpolatedValueCheck = createInterpolatedValueCheck(validator);
  const rulesetCheck = validator`
    {
      interpolated: ${interpolatedValueCheck}[] & ${expectDirectInstance(Array)} & ${expectNonSparse}
    } &
    ${createLazyEvaluator((target_: any) => {
      const target = target_ as { interpolated: InterpolatedValue[] };
      const interpolated = target.interpolated;
      return validator`{ rootRule: ${createRuleCheck(validator, interpolated)} }`;
    })} &
    ${expectDirectInstance(Object)} &
    ${expectKeysFrom(['interpolated', 'rootRule'])}
  `;

  return rulesetCheck;
}

export const _validationRulesInternals = {
  [packagePrivate]: { allSimpleTypes, createRulesetCheck, checkDynamicPropertyName },
};
