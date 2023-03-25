import { strict as assert } from 'node:assert';
import { createValidatorSyntaxError, ValidatorSyntaxError } from './exceptions';
import { TextPosition, TextRange, END_OF_TEXT, INTERPOLATION_POINT } from './TextPosition';
import { Token, TokenStream } from './types/tokenizer';
import { UnreachableCaseError } from './util';

// The regex is stateful with the sticky flag, so we create a new one each time
// we need one.
const getIdentifierPattern = (): RegExp => /[a-zA-Z$_][a-zA-Z0-9$_]*/y;

interface ExtractResult {
  readonly value: string
  readonly range: TextRange
}

function throwIndexOutOfBounds(): never {
  throw new Error('Internal error: Attempted to index an array with an out-of-bounds index.');
}

export function createTokenStream(sections: readonly string[]): TokenStream {
  let tokenStack: [Token, Token, Token, Token];
  {
    const beforeTextToken: Token = {
      category: 'beforeTextStart',
      value: '',
      afterNewline: false,
      range: { start: TextPosition.atStartPos(sections), end: TextPosition.atStartPos(sections) },
    };

    const firstToken = getNextToken(sections, TextPosition.atStartPos(sections));
    const secondToken = getNextToken(sections, firstToken.range.end);
    const thirdToken = getNextToken(sections, secondToken.range.end);

    tokenStack = [beforeTextToken, firstToken, secondToken, thirdToken];
  }

  return Object.freeze({
    originalText: sections,
    last() {
      return tokenStack[0];
    },
    next(): Token {
      tokenStack = [
        tokenStack[1],
        tokenStack[2],
        tokenStack[3],
        getNextToken(sections, tokenStack[3].range.end),
      ];
      return tokenStack[0];
    },
    peek(amount: 1 | 2 | 3 = 1): Token {
      return tokenStack[amount];
    },
  });
}

/**
 * Returns the extracted result, the first position in the extracted range
 * (i.e. the passed in pos object), and the last position in the extracted range.
 */
function extract(regex: RegExp, sections: readonly string[], pos: TextPosition): ExtractResult | null {
  assert(regex.sticky, 'Internal error: The sticky flag must be set');
  assert(regex.lastIndex === 0);

  regex.lastIndex = pos.textIndex;
  const match = regex.exec(sections[pos.sectionIndex] ?? throwIndexOutOfBounds());
  regex.lastIndex = 0;

  if (match === null || match[0] === '') {
    return null;
  } else {
    const theExtract = match[0] ?? throwIndexOutOfBounds();
    const newPos = pos.advance(theExtract.length);
    return { value: theExtract, range: { start: pos, end: newPos } };
  }
}

type ExtractStringResult = { parsedValue: string, range: TextRange } | null;

function extractString(sections: readonly string[], startPos: TextPosition): ExtractStringResult {
  let currentPos = startPos;

  const openingQuote = currentPos.getChar();
  if (openingQuote !== '"' && openingQuote !== "'") {
    return null;
  }
  currentPos = currentPos.advance(1); // go past the opening quote

  const unexpectedEndOfStringError = (errorRange: TextRange): ValidatorSyntaxError => {
    return createValidatorSyntaxError('Expected to find a quote to end the string literal.', sections, errorRange);
  };

  let result = '';
  while (true) {
    const char = currentPos.getChar();
    if (char === INTERPOLATION_POINT || char === END_OF_TEXT) {
      throw unexpectedEndOfStringError({ start: startPos, end: currentPos });
    }

    if (char === openingQuote) {
      break;
    } else if (char === '\\') {
      const extracted = extractStringEscapeSequence(sections, currentPos);
      if ('error' in extracted) {
        if (extracted.error === 'UNTERMINATED_STRING') {
          throw unexpectedEndOfStringError({ start: startPos, end: extracted.endPos });
        } else {
          throw new UnreachableCaseError(extracted.error);
        }
      }
      result += extracted.value;
      currentPos = extracted.range.end;
    } else {
      result += char;
      currentPos = currentPos.advance(1);
    }
  }

  // Advance past the closing quote
  currentPos = currentPos.advance(1);

  return { parsedValue: result, range: { start: startPos, end: currentPos } };
}

interface ExtractStringEscapeSequenceErrorResult {
  readonly error: 'UNTERMINATED_STRING'
  readonly endPos: TextPosition
}

function extractStringEscapeSequence(sections: readonly string[], slashPos: TextPosition): ExtractResult | ExtractStringEscapeSequenceErrorResult {
  assert(slashPos.getChar() === '\\');
  const escapeCharPos = slashPos.advance(1);
  const escapedChar = escapeCharPos.getChar();
  if (escapedChar === INTERPOLATION_POINT || escapedChar === END_OF_TEXT) {
    return { error: 'UNTERMINATED_STRING', endPos: escapeCharPos };
  }

  if (escapedChar === 'x') {
    const extracted = extract(/[0-9a-fA-F]{2}/y, sections, escapeCharPos.advance(1));
    if (extracted === null) {
      throw createValidatorSyntaxError(
        'Invalid unicode escape sequence: Expected exactly two hexadecimal digits to follow the "\\x".',
        sections,
        { start: slashPos, end: escapeCharPos.advance(1) },
      );
    }
    return {
      value: String.fromCharCode(parseInt(extracted.value, 16)),
      range: { start: slashPos, end: extracted.range.end },
    };
  } else if (escapedChar === 'u' && escapeCharPos.advance(1).getChar() === '{') {
    const extracted = extract(/\{[0-9a-fA-F]{1,6}\}/y, sections, escapeCharPos.advance(1));
    if (extracted === null) {
      throw createValidatorSyntaxError(
        'Invalid unicode escape sequence: Expected exactly six hexadecimal digits between "\\u{" and "}".',
        sections,
        { start: slashPos, end: escapeCharPos.advance(1) },
      );
    }

    const codePoint = parseInt(extracted.value.slice(1, -1), 16);
    let codePointAsChar: string;
    try {
      codePointAsChar = String.fromCodePoint(codePoint);
    } catch (error) {
      if (error instanceof RangeError) {
        const errorRange = { start: slashPos, end: extracted.range.end };
        throw createValidatorSyntaxError(`Invalid code point "0x${codePoint.toString(16)}".`, sections, errorRange);
      }
      throw error;
    }

    return {
      value: codePointAsChar,
      range: { start: slashPos, end: extracted.range.end },
    };
  } else if (escapedChar === 'u') {
    const extracted = extract(/[0-9a-fA-F]{4}/y, sections, escapeCharPos.advance(1));
    if (extracted === null) {
      throw createValidatorSyntaxError(
        'Invalid unicode escape sequence: Expected exactly four hexadecimal digits to follow the "\\u".',
        sections,
        { start: slashPos, end: escapeCharPos.advance(1) },
      );
    }
    return {
      value: String.fromCharCode(parseInt(extracted.value, 16)),
      range: { start: slashPos, end: extracted.range.end },
    };
  } else {
    const mapSpecialChars: { [index: string]: string | undefined } = {
      0: '\0',
      '\\': '\\',
      n: '\n',
      r: '\r',
      v: '\v',
      t: '\t',
      b: '\b',
      f: '\f',
    };

    return {
      value: mapSpecialChars[escapedChar] ?? escapedChar,
      range: { start: slashPos, end: escapeCharPos.advance(1) },
    };
  }
}

function extractNumber(sections: readonly string[], startPos: TextPosition): ExtractResult | null {
  return (
    // hexadecimal literal
    extract(/0[xX]([0-9a-fA-F]+_)*[0-9a-fA-F]+/y, sections, startPos) ??
    // octal literal
    extract(/0[oO]([0-7]+_)*[0-7]+/y, sections, startPos) ??
    // binary literal
    extract(/0[bB]([01]+_)*[01]+/y, sections, startPos) ??
    // base-10 literal with decimal and scientific notation support
    extract(/(((\d+_)*\d+)?\.)?(\d+_)*\d+([eE](\d+_)*\d+)?/y, sections, startPos) ??
    // nothing matched
    null
  );
}

function getNextToken(sections: readonly string[], startingPos: TextPosition): Token {
  const { newPos: posAfterWhitespace, foundNewLine } = ignoreWhitespaceAndComments(sections, startingPos);
  const mixin = { afterNewline: foundNewLine };

  if (posAfterWhitespace.atEndOfText()) {
    return {
      category: 'eof',
      ...mixin,
      value: '',
      range: { start: posAfterWhitespace, end: posAfterWhitespace },
    };
  } else if (posAfterWhitespace.atInterpolationPoint()) {
    const posAfterSection = posAfterWhitespace.advance(1);
    return {
      category: 'interpolation' as const,
      ...mixin,
      value: undefined,
      interpolationIndex: posAfterWhitespace.sectionIndex,
      range: { start: posAfterWhitespace, end: posAfterSection },
    };
  }

  let extracted: ExtractResult | null;

  extracted = extract(getIdentifierPattern(), sections, posAfterWhitespace);
  if (extracted !== null) {
    return { category: 'identifier', ...extracted, ...mixin };
  }

  extracted = extract(/\d+n/y, sections, posAfterWhitespace);
  if (extracted !== null) {
    return { category: 'bigint', ...extracted, ...mixin };
  }

  extracted = extractNumber(sections, posAfterWhitespace);
  if (extracted !== null) {
    return { category: 'number', ...extracted, ...mixin };
  }

  extracted = extract(/[[\]{}()@<>:;,\-+|&?]|(\.\.\.)/y, sections, posAfterWhitespace);
  if (extracted !== null) {
    return { category: 'specialChar', ...extracted, ...mixin };
  }

  const extractedStringInfo = extractString(sections, posAfterWhitespace);
  if (extractedStringInfo !== null) {
    return {
      category: 'string',
      ...mixin,
      value: undefined,
      parsedValue: extractedStringInfo.parsedValue,
      range: extractedStringInfo.range,
    };
  }

  extracted = extract(/\S+/y, sections, posAfterWhitespace);
  assert(extracted !== null);
  throw createValidatorSyntaxError('Failed to interpret this syntax.', sections, extracted.range);
}

function ignoreWhitespaceAndComments(sections: readonly string[], startingPos: TextPosition): { foundNewLine: boolean, newPos: TextPosition } {
  let currentPos = startingPos;

  while (true) {
    const startingIndex = currentPos.textIndex;
    let extracted: ExtractResult | null;

    // whitespace
    currentPos = extract(/\s+/y, sections, currentPos)?.range.end ?? currentPos;

    // block comments
    extracted = extract(/\/\*/y, sections, currentPos);
    if (extracted !== null) {
      currentPos = extracted.range.end;
      const { newPos, matchFound } = eatUntil(sections, currentPos, /(.|\n)*?\*\//y);
      if (!matchFound) {
        throw createValidatorSyntaxError('This block comment never got closed.', sections, extracted.range);
      }
      currentPos = newPos;
    }

    // single-line comments
    extracted = extract(/\/\//y, sections, currentPos);
    if (extracted !== null) {
      currentPos = extracted.range.end;
      // ignoring `matchFound`. If no match is found, then there was simply a single-line
      // comment at the end of the whole string, so it didn't have a newline afterwards.
      const { newPos, matchFound } = eatUntil(sections, currentPos, /(.|\n)*?\n/y);
      currentPos = newPos;
    }

    if (startingIndex === currentPos.textIndex) break;
  }

  return {
    foundNewLine: currentPos.lineNumb > startingPos.lineNumb,
    newPos: currentPos,
  };
}

/**
 * Keeps moving currentPos (including across interpolation points) until
 * the provided pattern is matched. currentPos will be set to the position
 * right after the matched text.
 */
function eatUntil(
  sections: readonly string[],
  startingPos: TextPosition,
  pattern: RegExp,
): { newPos: TextPosition, matchFound: boolean } {
  let currentPos = startingPos;
  while (true) {
    const extracted = extract(pattern, sections, currentPos);
    if (extracted !== null) {
      return { newPos: extracted.range.end, matchFound: true };
    }

    currentPos = currentPos.advanceToSectionEnd();
    if (currentPos.atEndOfText()) {
      return { newPos: currentPos, matchFound: false };
    } else {
      assert(currentPos.atInterpolationPoint());
      currentPos = currentPos.advance(1);
    }
  }
}

export function isIdentifier(text: string): boolean {
  const match = getIdentifierPattern().exec(text);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return match !== null && match[0]!.length === text.length;
}
