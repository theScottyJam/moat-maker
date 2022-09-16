// Everything in here is publically exported

export type simpleTypeVariant = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'object' | 'null' | 'undefined';

export interface SimpleRule {
  readonly category: 'simple'
  readonly type: simpleTypeVariant
}

export interface NoopRule {
  readonly category: 'noop'
}

export interface UnionRule {
  readonly category: 'union'
  readonly variants: Rule[]
}

export type Rule = SimpleRule | NoopRule | UnionRule;
