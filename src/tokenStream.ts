import { strict as assert } from 'node:assert';
import { ValidatorSyntaxError } from './exceptions';
import { TextPosition, Token, TokenStream } from './types/tokenizer';

/// Returns the extracted result, the first position in the extracted range range
/// (i.e. the passed in pos object), and the last position in the extracted range.
function extract(regex: RegExp, text: string, pos_: TextPosition): [string | null, TextPosition, TextPosition] {
  const pos = { ...pos_ };
  assert(regex.sticky, 'Internal error: The sticky flag must be set');
  assert(regex.lastIndex === 0);

  regex.lastIndex = pos.index;
  const match = regex.exec(text);
  regex.lastIndex = 0;

  if (match === null || match[0] === '') {
    return [null, pos_, pos_];
  }

  const theExtract = match[0];
  pos.index += theExtract.length;
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

export function createTokenStream(parts: TemplateStringsArray): TokenStream {
  const content = parts[0];

  let currentPos = {
    index: 0,
    lineNumb: 1,
    colNumb: 1,
  };

  const getNextToken = (): Token => {
    [,, currentPos] = extract(/\s+/y, content, currentPos); // skip whitespace

    if (currentPos.index === content.length) {
      return {
        category: 'eof',
        value: '',
        range: { start: currentPos, end: currentPos },
      };
    }

    let lastPos: TextPosition;
    let segment: string | null;

    [segment, lastPos, currentPos] = extract(/[a-zA-Z]+/y, content, currentPos);
    if (segment !== null) {
      return {
        category: 'identifier',
        value: segment,
        range: { start: lastPos, end: currentPos },
      };
    }

    [segment, lastPos, currentPos] = extract(/\|/y, content, currentPos);
    if (segment !== null) {
      return {
        category: 'specialChar',
        value: segment,
        range: { start: lastPos, end: currentPos },
      };
    }

    [segment, lastPos, currentPos] = extract(/\S+/y, content, currentPos);
    assert(segment);
    const errorRange = { start: lastPos, end: currentPos };
    throw new ValidatorSyntaxError('Failed to interpret this syntax.', content, errorRange);
  };

  let curToken = getNextToken();
  return Object.freeze({
    originalText: content,
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
