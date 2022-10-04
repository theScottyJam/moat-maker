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
  readonly category: 'identifier' | 'number' | 'specialChar' | 'eof'
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
  readonly next: () => Token
  readonly peek: () => Token
  readonly lastTokenEndPos: () => TextPosition
}
