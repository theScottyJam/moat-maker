// Everything in here is publicly exported

export type simpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';

export interface SimpleRule {
  readonly category: 'simple'
  readonly type: simpleTypeVariant
}

export interface NoopRule {
  readonly category: 'noop'
}

export interface ObjectRule {
  readonly category: 'object'
  readonly content: {
    readonly [key: string]: {
      readonly optional: boolean
      readonly rule: Rule
    }
  }
  readonly index: Rule | null
}

export interface ArrayRule {
  readonly category: 'array'
  readonly content: Rule
}

export interface UnionRule {
  readonly category: 'union'
  readonly variants: Rule[]
}

export interface InterpolationRule {
  readonly category: 'interpolation'
  readonly interpolationIndex: number
}

export type Rule = SimpleRule | NoopRule | ObjectRule | ArrayRule | UnionRule | InterpolationRule;
