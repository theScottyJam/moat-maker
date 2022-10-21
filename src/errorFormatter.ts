// Note that sometimes this module uses the term "char" loosely,
// and may call strings like "${…}" or "\\n" a "char".

import { strict as assert } from 'node:assert';
import { TextPosition, TextRange, ContentPointedAt, INTERPOLATION_POINT, END_OF_TEXT } from './TextPosition';
import { indentMultilineString, pipe } from './util';

const MAX_LINE_WIDTH = 70;
const MAX_UNDERLINED_WIDTH = 40;

interface TextParts {
  readonly displaysBeforeUnderline: StringArray
  readonly underlined: StringArray
  readonly displaysAfterUnderline: StringArray
}

export function generateMessageWithPosition(message: string, text: readonly string[], range: TextRange): string {
  const startOfFirstErrorLine = findBeginningOfLine(text, range.start);
  const endOfLastErrorLine = findEndOfLine(range.end);
  const asStringArray = (text: string[]): StringArray => new StringArray(text);

  const textBeingDisplayedParts: TextParts = {
    displaysBeforeUnderline: pipe(
      TextPosition.getSlice(startOfFirstErrorLine, range.start),
      removeLeadingWhitespace,
      replaceSpecialChars,
      asStringArray,
    ),
    underlined: pipe(
      TextPosition.getSlice(range.start, range.end),
      replaceSpecialChars,
      asStringArray,
    ),
    displaysAfterUnderline: pipe(
      TextPosition.getSlice(range.end, endOfLastErrorLine),
      replaceSpecialChars,
      asStringArray,
    ),
  };

  const underlinedText = pipe(
    textBeingDisplayedParts,
    truncateUnderlinedPortionIfTooLarge,
    (parts: TextParts) => (
      attemptToFitEverythingUsingOnlyARightTruncate(parts) ??
      truncateOnBothEnds(parts)
    ),
    renderUnderlinedText,
  );

  return [
    `${message} (line ${range.start.lineNumb}, col ${range.start.colNumb})`,
    indentMultilineString(underlinedText, 2),
  ].join('\n');
}

const replaceSpecialChars = (text: readonly ContentPointedAt[]): readonly string[] => {
  return text.map(char => {
    if (char === '\n') return '\\n';
    if (char === INTERPOLATION_POINT) return '${…}';
    return char;
  });
};

function removeLeadingWhitespace(text: readonly ContentPointedAt[]): readonly ContentPointedAt[] {
  const notWhitespaceIndex = text.findIndex(char => typeof char !== 'string' || /^\s$/.exec(char) === null);
  return text.slice(notWhitespaceIndex);
}

/**
 * If the underlined portion crosses a threshold, its center will be replaced with a "…".
 */
function truncateUnderlinedPortionIfTooLarge(parts: TextParts): TextParts {
  if (parts.underlined.contentLength <= MAX_UNDERLINED_WIDTH) {
    return parts;
  }

  const center = '…';
  const left = new StringArray(parts.underlined.array);
  const rightReversed = new StringArray();

  // Moves content so there's an even amount of content in both arrays.
  while (left.contentLength > rightReversed.contentLength) {
    rightReversed.push(left.pop() as string);
  }

  while (left.contentLength + center.length + rightReversed.contentLength > MAX_UNDERLINED_WIDTH) {
    popFromSmallest(left, rightReversed);
  }

  return {
    ...parts,
    underlined: new StringArray([...left.array, center, ...rightReversed.reversed().array]),
  };
}

/**
 * Attempts to keep the text within a max size limit by only truncating on the right side, if needed.
 * If The truncation would cause part of the underlined portion to be lost, then this will fail and return null.
 * pre-condition: The underlined must already be truncated if it was too large.
 */
function attemptToFitEverythingUsingOnlyARightTruncate(parts: TextParts): TextParts | null {
  const mustBeVisible = parts.displaysBeforeUnderline.contentLength + parts.underlined.contentLength;
  if (mustBeVisible >= MAX_LINE_WIDTH) {
    return null;
  }

  const newAfterUnderline: StringArray = new StringArray();
  const etcChar = '…';
  for (const char of parts.displaysAfterUnderline.array) {
    if (mustBeVisible + newAfterUnderline.contentLength + etcChar.length + char.length > MAX_LINE_WIDTH) {
      newAfterUnderline.push(etcChar);
      break;
    }
    newAfterUnderline.push(char);
  }

  return {
    ...parts,
    displaysAfterUnderline: newAfterUnderline,
  };
}

/**
 * Centers the underlined portion and truncate the text on both ends.
 * pre-condition: The underlined must already be truncated if it was too large.
 */
function truncateOnBothEnds(parts: TextParts): TextParts {
  const newBeforeUnderlineReversed = parts.displaysBeforeUnderline.reversed();
  const newAfterUnderline = new StringArray(parts.displaysAfterUnderline.array);
  while (newBeforeUnderlineReversed.contentLength + parts.underlined.contentLength + newAfterUnderline.contentLength > MAX_LINE_WIDTH) {
    popFromSmallest(newBeforeUnderlineReversed, newAfterUnderline);
  }

  newBeforeUnderlineReversed.pop();
  newBeforeUnderlineReversed.push('…');
  if (newAfterUnderline.contentLength !== parts.displaysAfterUnderline.contentLength) {
    newAfterUnderline.pop();
    newAfterUnderline.push('…');
  }

  return {
    displaysBeforeUnderline: newBeforeUnderlineReversed.reversed(),
    underlined: parts.underlined,
    displaysAfterUnderline: newAfterUnderline,
  };
}

/**
 * Converts a given line of code and underline position information into a single string
 * with the underline drawn in the correct location under the provided line.
 */
function renderUnderlinedText(parts: TextParts): string {
  const leftOfUnderlined = parts.displaysBeforeUnderline.array.join('');
  const underlined = parts.underlined.array.join('');
  const rightOfUnderlined = parts.displaysAfterUnderline.array.join('');
  return [
    (leftOfUnderlined + underlined + rightOfUnderlined).trimEnd(),
    ' '.repeat(leftOfUnderlined.length) + '~'.repeat(Math.max(underlined.length, 1)),
  ].join('\n');
}

function findBeginningOfLine(text: readonly string[], startPos: TextPosition): TextPosition {
  let pos = startPos;
  while (true) {
    if (pos.atStartOfText() || pos.getPreviousChar() === '\n') {
      return pos;
    }
    pos = pos.backtrackInLine(1);
  }
}

// eslint-disable-next-line consistent-return
function findEndOfLine(startPos: TextPosition): TextPosition {
  for (const pos of startPos.iterForwards()) {
    const char = pos.getChar();
    if (char === '\n' || char === END_OF_TEXT) {
      return pos;
    }
  }
  assert.fail();
}

/**
 * Pops from the smallest of the two string-arrays, preferring the second argument
 * if they're the same size.
 */
function popFromSmallest(stringArray1: StringArray, stringArray2: StringArray): void {
  let popped: string | undefined;
  if (stringArray1.contentLength >= stringArray2.contentLength) {
    popped = stringArray1.pop();
  } else {
    popped = stringArray2.pop();
  }
  assert(popped !== undefined);
}

/**
 * Helper class that helps keep the array and the length of its combined content in sync.
 */
class StringArray {
  #array;
  #contentLength;
  constructor(content: readonly string[] = []) {
    this.#array = [...content];
    this.#contentLength = content.join('').length;
  }

  get array(): readonly string[] {
    return this.#array;
  }

  get contentLength(): number {
    return this.#contentLength;
  }

  push(value: string): void {
    this.#array.push(value);
    this.#contentLength += value.length;
  }

  pop(): string | undefined {
    const value = this.#array.pop();
    this.#contentLength -= value?.length ?? 0;
    return value;
  }

  /** Returns a reversed copy. */
  reversed(): StringArray {
    return new StringArray([...this.#array].reverse());
  }
}
