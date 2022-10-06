// Everything in here is publicly exported

import type { FrozenMap } from '../util';

export type simpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';

export interface SimpleRule {
  readonly category: 'simple'
  readonly type: simpleTypeVariant
}

export interface PrimitiveLiteralRule {
  readonly category: 'primitiveLiteral'
  readonly value: string | number
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
}

export interface ObjectRule {
  readonly category: 'object'
  // We only ever return rules with frozen maps, but we accept rules of type map,
  // which is the reason for this union type.
  readonly content: FrozenMap<string, ObjectRuleContentValue> | Map<string, ObjectRuleContentValue>
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
  | InterpolationRule
);
