import { strict as assert } from 'node:assert';
import { createValidatorSyntaxError } from './exceptions';
import { TextPosition, TextRange } from './TextPosition';
import { Token, TokenStream } from './types/tokenizer';

// The regex is stateful with the sticky flag, so we create a new one each time
// we need one.
const getIdentifierPattern = (): RegExp => /[a-zA-Z$_][a-zA-Z0-9$_]*/y;

type ExtractResult = { value: string, range: TextRange } | null;

/// Returns the extracted result, the first position in the extracted range range
/// (i.e. the passed in pos object), and the last position in the extracted range.
function extract(regex: RegExp, sections: readonly string[], pos: TextPosition): ExtractResult {
  assert(regex.sticky, 'Internal error: The sticky flag must be set');
  assert(regex.lastIndex === 0);

  regex.lastIndex = pos.textIndex;
  const match = regex.exec(sections[pos.sectionIndex]);
  regex.lastIndex = 0;

  if (match === null || match[0] === '') {
    return null;
  } else {
    const theExtract = match[0];
    const newPos = pos.advanceInSection(theExtract.length);
    return { value: theExtract, range: { start: pos, end: newPos } };
  }
}

type ExtractStringResult = { parsedValue: string, range: TextRange } | null;

function extractString(sections: readonly string[], startPos: TextPosition): ExtractStringResult {
  let currentPos = startPos;

  const targetSection = sections[currentPos.sectionIndex];
  const openingQuote = targetSection[currentPos.textIndex];
  if (!['"', "'"].includes(openingQuote)) {
    return null;
  }

  let result = '';
  let escaping = false;
  while (true) {
    currentPos = currentPos.advanceInSection(1);
    const char = targetSection[currentPos.textIndex];
    if (char === undefined) {
      const errorRange = { start: startPos, end: currentPos };
      throw createValidatorSyntaxError('Expected to find a quote to end the string literal.', sections, errorRange);
    }

    if (!escaping && char === openingQuote) {
      break;
    } else if (!escaping && char === '\\') {
      escaping = true;
    } else if (escaping) {
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
      result += mapSpecialChars[char] ?? char;
      escaping = false;
    } else {
      result += char;
    }
  }

  currentPos = currentPos.advanceInSection(1);
  return { parsedValue: result, range: { start: startPos, end: currentPos } };
}

function extractNumber(sections: readonly string[], startPos: TextPosition): ExtractResult {
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

export function createTokenStream(sections: readonly string[]): TokenStream {
  let nextToken = getNextToken(sections, TextPosition.atStartPos(sections));
  // lastTokenEndPos would be the same as peek().range.start if it weren't for the possibility
  // of whitespace between them.
  let lastTokenEndPos = TextPosition.atStartPos(sections);
  return Object.freeze({
    originalText: sections,
    next(): Token {
      const requestedToken = nextToken;
      lastTokenEndPos = requestedToken.range.end;
      nextToken = getNextToken(sections, lastTokenEndPos);
      return requestedToken;
    },
    peek(): Token {
      return nextToken;
    },
    lastTokenEndPos() {
      return lastTokenEndPos;
    },
  });
}

function getNextToken(sections: readonly string[], startingPos: TextPosition): Token {
  const { newPos: posAfterWhitespace, foundNewLine } = ignoreWhitespaceAndComments(sections, startingPos);
  const mixin = { afterNewline: foundNewLine };

  if (posAfterWhitespace.atEndOfSegment()) {
    const posAfterSection = posAfterWhitespace.advanceToNextSection();
    if (posAfterSection === null) {
      return {
        category: 'eof',
        ...mixin,
        value: '',
        range: { start: posAfterWhitespace, end: posAfterWhitespace },
      };
    } else {
      return {
        category: 'interpolation' as const,
        ...mixin,
        value: undefined,
        interpolationIndex: posAfterSection.sectionIndex,
        range: { start: posAfterWhitespace, end: posAfterSection },
      };
    }
  }

  let extracted: ExtractResult;

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
    let extracted: ExtractResult;

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

/// Keeps moving currentPos (including across interpolation points) until
/// the provided pattern is matched. currentPos will be set to the position
/// right after the matched text.
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

    let nextPos = currentPos.advanceToNextSection();
    if (nextPos === null) {
      nextPos = currentPos.advanceToSegmentEnd();
      return { newPos: nextPos, matchFound: false };
    } else {
      currentPos = nextPos;
    }
  }
}

export function isIdentifier(text: string): boolean {
  const match = getIdentifierPattern().exec(text);
  return match !== null && match[0].length === text.length;
}
