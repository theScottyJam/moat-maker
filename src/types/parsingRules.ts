// Everything in here is publicly exported.
// Each interface defined in here is also copy-pasted onto the doc website, to explain
// what shape of data we expect to find in a ruleset.
// See the doc page here: https://thescottyjam.gitbook.io/moat-maker/resources/syntax-reference

import { FrozenMap } from '../util';
import type { Validator, ValidatorTemplateTag } from './validator';
import { packagePrivate } from '../packagePrivateAccess';

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

export interface IteratorRule {
  readonly category: 'iterator'
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
  | IteratorRule
  | UnionRule
  | IntersectionRule
  | InterpolationRule
);

const allCategories = [
  'simple',
  'primitiveLiteral',
  'noop',
  'object',
  'array',
  'tuple',
  'iterator',
  'union',
  'intersection',
  'interpolation',
] as const;

export interface Ruleset {
  readonly rootRule: Rule
  readonly interpolated: readonly unknown[]
}

function createRulesetCheck(validator: ValidatorTemplateTag): Validator {
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

  const objectRuleCheck = validator`{
    category: 'object'
    content: (${FrozenMap} | ${Map})@<[string, ${objectRuleContentValueCheck}]>
    dynamicContent: (${FrozenMap} | ${Map})@<[number, ${objectRuleContentValueCheck}]>
    index: ${objectRuleIndexValueCheck} | null
  }`;

  const arrayRuleCheck = validator`{
    category: 'array'
    content: ${ruleRef}
  }`;

  const tupleRuleCheck = validator`{
    category: 'tuple'
    content: ${ruleRef}[]
    optionalContent: ${ruleRef}[]
    rest: ${ruleRef} | null
    entryLabels: string[] | null
  }`;

  const iteratorRuleCheck = validator`{
    category: 'iterator'
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
    | ${iteratorRuleCheck}
    | ${unionRuleCheck}
    | ${intersectionRuleCheck}
    | ${interpolationRuleCheck}
  `;

  ruleRef.set(ruleCheck);

  const rulesetCheck = validator`{
    rootRule: ${ruleCheck}
    interpolated: unknown[]
  }`;

  return rulesetCheck;
}

export const _parsingRulesInternals = {
  [packagePrivate]: { allCategories, allSimpleTypes, createRulesetCheck },
};
