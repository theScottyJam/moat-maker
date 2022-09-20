export interface TextPosition {
  readonly sectionIndex: number
  readonly textIndex: number
  readonly lineNumb: number
  readonly colNumb: number
}

export interface TextRange {
  readonly start: TextPosition
  readonly end: TextPosition
}

export interface TextToken {
  readonly category: 'identifier' | 'specialChar' | 'eof'
  readonly value: string
  readonly range: TextRange
}

export interface InterpolationToken {
  readonly category: 'interpolation'
  readonly value: undefined
  readonly interpolationIndex: number
  readonly range: TextRange
}

export type Token = TextToken | InterpolationToken;

export interface TokenStream {
  readonly originalText: readonly string[]
  readonly next: () => Token
  readonly peek: () => Token
}
