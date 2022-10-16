import type { TextPosition, TextRange } from '../TextPosition';

// Note that a number like "Infinity" get classified as an identifier,
export interface TextToken {
  readonly category: 'identifier' | 'number' | 'bigint' | 'specialChar' | 'eof' | 'beforeTextStart'
  readonly value: string
  readonly afterNewline: boolean
  readonly range: TextRange
}

export interface StringToken {
  readonly category: 'string'
  readonly value: undefined
  readonly parsedValue: string
  readonly afterNewline: boolean
  readonly range: TextRange
}

export interface InterpolationToken {
  readonly category: 'interpolation'
  readonly value: undefined
  readonly afterNewline: boolean
  readonly interpolationIndex: number
  readonly range: TextRange
}

export type Token = TextToken | StringToken | InterpolationToken;

export interface TokenStream {
  readonly originalText: readonly string[]
  readonly last: () => Token
  readonly next: () => Token
  readonly peek: (amount?: 1 | 2 | 3) => Token
}
