export interface TextPosition {
  readonly index: number
  readonly lineNumb: number
  readonly colNumb: number
}

export interface TextRange {
  readonly start: TextPosition
  readonly end: TextPosition
}

export interface Token {
  readonly category: 'identifier' | 'specialChar' | 'eof'
  readonly value: string
  readonly range: TextRange
}

export interface TokenStream {
  readonly originalText: string
  readonly next: () => Token
  readonly peek: () => Token
}
