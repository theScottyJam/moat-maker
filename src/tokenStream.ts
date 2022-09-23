import { strict as assert } from 'node:assert';
import { ValidatorSyntaxError } from './exceptions';
import { TextPosition, Token, TokenStream } from './types/tokenizer';

/// Returns the extracted result, the first position in the extracted range range
/// (i.e. the passed in pos object), and the last position in the extracted range.
function extract(regex: RegExp, sections: readonly string[], pos_: TextPosition): [string | null, TextPosition, TextPosition] {
  const pos = { ...pos_ };
  assert(regex.sticky, 'Internal error: The sticky flag must be set');
  assert(regex.lastIndex === 0);

  regex.lastIndex = pos.textIndex;
  const match = regex.exec(sections[pos.sectionIndex]);
  regex.lastIndex = 0;

  if (match === null || match[0] === '') {
    return [null, pos_, pos_];
  }

  const theExtract = match[0];
  pos.textIndex += theExtract.length;
  for (const c of theExtract) {
    if (c === '\n') {
      pos.lineNumb++;
      pos.colNumb = 1;
    } else {
      pos.colNumb++;
    }
  }

  return [theExtract, pos_, Object.freeze(pos)];
}

export function createTokenStream(sections: TemplateStringsArray): TokenStream {
  let currentPos = {
    sectionIndex: 0,
    textIndex: 0,
    lineNumb: 1,
    colNumb: 1,
  };

  const getNextToken = (): Token => {
    let afterNewline;
    ({ newPos: currentPos, foundNewLine: afterNewline } = ignoreWhitespaceAndComments(sections, currentPos));

    if (currentPos.textIndex === sections[currentPos.sectionIndex].length) {
      // If reached end of entire string
      if (currentPos.sectionIndex === sections.length - 1) {
        return {
          category: 'eof',
          value: '',
          afterNewline,
          range: { start: currentPos, end: currentPos },
        };
      } else {
        const lastPos = currentPos;
        currentPos = {
          ...lastPos,
          sectionIndex: lastPos.sectionIndex + 1,
          textIndex: 0,
        };
        const token = {
          category: 'interpolation' as const,
          value: undefined,
          afterNewline,
          interpolationIndex: currentPos.sectionIndex,
          range: { start: lastPos, end: currentPos },
        };
        return token;
      }
    }

    let lastPos: TextPosition;
    let segment: string | null;

    [segment, lastPos, currentPos] = extract(/[a-zA-Z$_][a-zA-Z0-9$_]*/y, sections, currentPos);
    if (segment !== null) {
      return {
        category: 'identifier',
        value: segment,
        afterNewline,
        range: { start: lastPos, end: currentPos },
      };
    }

    [segment, lastPos, currentPos] = extract(/(\d*\.)?\d+/y, sections, currentPos);
    if (segment !== null) {
      return {
        category: 'number',
        value: segment,
        afterNewline,
        range: { start: lastPos, end: currentPos },
      };
    }

    [segment, lastPos, currentPos] = extract(/[{}:;,|?]/y, sections, currentPos);
    if (segment !== null) {
      return {
        category: 'specialChar',
        value: segment,
        afterNewline,
        range: { start: lastPos, end: currentPos },
      };
    }

    [segment, lastPos, currentPos] = extract(/\S+/y, sections, currentPos);
    assert(segment);
    const errorRange = { start: lastPos, end: currentPos };
    throw new ValidatorSyntaxError('Failed to interpret this syntax.', sections, errorRange);
  };

  let curToken = getNextToken();
  return Object.freeze({
    originalText: sections,
    next(): Token {
      const lastToken = curToken;
      curToken = getNextToken();
      return lastToken;
    },
    peek(): Token {
      return curToken;
    },
  });
}

function ignoreWhitespaceAndComments(sections: TemplateStringsArray, startingPos: TextPosition): { foundNewLine: boolean, newPos: TextPosition } {
  let currentPos = startingPos;

  while (true) {
    const startingIndex = currentPos.textIndex;
    let segment, lastPos;

    // whitespace
    [,, currentPos] = extract(/\s+/y, sections, currentPos);

    // block comments
    [segment, lastPos, currentPos] = extract(/\/\*/y, sections, currentPos);
    if (segment !== null) {
      const { newPos, matchFound } = eatUntil(sections, currentPos, /(.|\n)*?\*\//y);
      if (!matchFound) {
        const errorRange = { start: lastPos, end: currentPos };
        throw new ValidatorSyntaxError('This block comment never got closed.', sections, errorRange);
      }
      currentPos = newPos;
    }

    // single-line comments
    [segment,, currentPos] = extract(/\/\//y, sections, currentPos);
    if (segment !== null) {
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
function eatUntil(sections: TemplateStringsArray, startingPos: TextPosition, pattern: RegExp): { newPos: TextPosition, matchFound: boolean } {
  let currentPos = startingPos;
  while (true) {
    let segment;
    [segment,, currentPos] = extract(pattern, sections, currentPos);
    if (segment !== null) {
      return { newPos: currentPos, matchFound: true };
    }

    // If reached end of entire string
    if (currentPos.sectionIndex === sections.length - 1) {
      [,, currentPos] = extract(/.*/y, sections, currentPos); // move currentPos to the end
      return { newPos: currentPos, matchFound: false };
    } else {
      const lastPos = currentPos;
      currentPos = {
        ...lastPos,
        sectionIndex: lastPos.sectionIndex + 1,
        textIndex: 0,
      };
    }
  }
}
