// Note that sometimes this module uses the term "char" loosely,
// and may call strings like "${…}" or "\\n" a "char".

import { strict as assert } from 'node:assert';
import { TextPosition, TextRange, ContentPointedAt, INTERPOLATION_POINT, END_OF_TEXT } from './TextPosition';
import { pipe } from './util';

const MAX_LINE_WIDTH = 70;
const MAX_UNDERLINED_WIDTH = 40;

interface TextParts {
  readonly displaysBeforeUnderline: readonly string[]
  readonly underlined: readonly string[]
  readonly displaysAfterUnderline: readonly string[]
}

export function generateMessageWithPosition(message: string, text: readonly string[], range: TextRange): string {
  const textBeingDisplayedParts: TextParts = {
    displaysBeforeUnderline: pipe(
      getDisplayTextBeforeUnderline(text, range),
      removeLeadingWhitespace,
      replaceSpecialChars,
    ),
    underlined: pipe(
      getUnderlinedText(range),
      replaceSpecialChars,
    ),
    displaysAfterUnderline: pipe(
      getDisplayTextAfterUnderline(range),
      replaceSpecialChars,
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
    indent(underlinedText, 2),
  ].join('\n');
}

const replaceSpecialChars = (text: readonly ContentPointedAt[]): readonly string[] => {
  return text.map(char => {
    if (char === '\n') return '\\n';
    if (char === INTERPOLATION_POINT) return '${…}'; // eslint-disable-line no-template-curly-in-string
    return char;
  });
};

function removeLeadingWhitespace(text: readonly ContentPointedAt[]): readonly ContentPointedAt[] {
  const notWhitespaceIndex = text.findIndex(char => typeof char !== 'string' || /^\s$/.exec(char) === null);
  return text.slice(notWhitespaceIndex);
}

function getUnderlinedText(rangeBeingUnderlined: TextRange): readonly ContentPointedAt[] {
  const underlined: ContentPointedAt[] = [];
  for (const pos of rangeBeingUnderlined.start.iterForwards()) {
    const char = pos.getChar();
    if (pos.equals(rangeBeingUnderlined.end) || char === END_OF_TEXT) break;
    underlined.push(char);
  }
  return underlined;
}

function getDisplayTextBeforeUnderline(text: readonly string[], rangeBeingUnderlined: TextRange): readonly ContentPointedAt[] {
  const displaysBeforeUnderline: ContentPointedAt[] = [];
  for (const pos of findBeginningOfLine(text, rangeBeingUnderlined.start).iterForwards()) {
    const char = pos.getChar();
    if (pos.equals(rangeBeingUnderlined.start) || char === END_OF_TEXT) break;
    displaysBeforeUnderline.push(char);
  }
  return displaysBeforeUnderline;
}

function getDisplayTextAfterUnderline(rangeBeingUnderlined: TextRange): readonly ContentPointedAt[] {
  const displaysAfterUnderline: ContentPointedAt[] = [];
  for (const pos of rangeBeingUnderlined.end.iterForwards()) {
    const char = pos.getChar();
    if (pos.getChar() === '\n' || char === END_OF_TEXT) break;
    displaysAfterUnderline.push(char);
  }
  return displaysAfterUnderline;
}

/// If the underlined portion crosses a threshold, its center will be replaced with a "…".
function truncateUnderlinedPortionIfTooLarge(parts: TextParts): TextParts {
  if (parts.underlined.join('').length <= MAX_UNDERLINED_WIDTH) {
    return parts;
  }

  const midPoint = Math.floor(parts.underlined.length / 2);
  const left = parts.underlined.slice(0, midPoint);
  const center = '…';
  const right = parts.underlined.slice(midPoint);
  let leftLen = left.join('').length;
  let rightLen = right.join('').length;
  while (leftLen + center.length + rightLen > MAX_UNDERLINED_WIDTH) {
    if (leftLen < rightLen) {
      const shiftedChar = right.shift();
      assert(shiftedChar !== undefined);
      rightLen -= shiftedChar.length;
    } else {
      const poppedChar = left.pop();
      assert(poppedChar !== undefined);
      leftLen -= poppedChar.length;
    }
  }

  return {
    ...parts,
    underlined: [...left, center, ...right],
  };
}

/// Attempts to keep the text within a max size limit by only truncating on the right side, if needed.
/// If The truncation would cause part of the underlined portion to be lost, then this will fail and return null.
/// pre-condition: The underlined must already be truncated if it was too large.
function attemptToFitEverythingUsingOnlyARightTruncate(parts: TextParts): TextParts | null {
  const mustBeVisible = parts.displaysBeforeUnderline.join('').length + parts.underlined.join('').length;
  if (mustBeVisible >= MAX_LINE_WIDTH) {
    return null;
  }

  const newAfterUnderline: string[] = [];
  let newAfterUnderlineLength = 0;
  for (const char of parts.displaysAfterUnderline) {
    if (mustBeVisible + newAfterUnderlineLength + char.length > MAX_LINE_WIDTH) {
      newAfterUnderline.pop();
      newAfterUnderline.push('…');
      break;
    }
    newAfterUnderline.push(char);
    newAfterUnderlineLength += char.length;
  }

  return {
    ...parts,
    displaysAfterUnderline: newAfterUnderline,
  };
}

/// Centers the underlined portion and truncate the text on both ends.
/// pre-condition: The underlined must already be truncated if it was too large.
function truncateOnBothEnds(parts: TextParts): TextParts {
  const underlineLen = parts.underlined.join('').length;
  const newBeforeUnderline = [...parts.displaysBeforeUnderline];
  const newAfterUnderline = [...parts.displaysAfterUnderline];
  let leftLen = newBeforeUnderline.join('').length;
  let rightLen = newAfterUnderline.join('').length;
  while (leftLen + underlineLen + rightLen > MAX_LINE_WIDTH) {
    if (leftLen > rightLen) {
      const shiftedChar = newBeforeUnderline.shift();
      assert(shiftedChar !== undefined);
      leftLen -= shiftedChar.length;
    } else {
      const poppedChar = newAfterUnderline.pop();
      assert(poppedChar !== undefined);
      rightLen -= poppedChar.length;
    }
  }
  return {
    displaysBeforeUnderline: ['…', ...newBeforeUnderline.slice(1)],
    underlined: parts.underlined,
    displaysAfterUnderline: newAfterUnderline.length === parts.displaysAfterUnderline.length
      ? newAfterUnderline
      : [...newAfterUnderline.slice(0, -1), '…'],
  };
}

/// Converts a given line of code and underline position information into a single string
/// with the underline drawn in the correct location under the provided line.
function renderUnderlinedText(parts: TextParts): string {
  const leftOfUnderlined = parts.displaysBeforeUnderline.join('');
  const underlined = parts.underlined.join('');
  const rightOfUnderlined = parts.displaysAfterUnderline.join('');
  return [
    (leftOfUnderlined + underlined + rightOfUnderlined).trimEnd(),
    ' '.repeat(leftOfUnderlined.length) + '~'.repeat(Math.max(underlined.length, 1)),
  ].join('\n');
}

function findBeginningOfLine(text: readonly string[], startPos: TextPosition): TextPosition {
  let currentPos = startPos;
  while (true) {
    if (currentPos.atStartOfSection()) { // TODO: Should this be a while loop instead?
      const newPos = currentPos.backtrackToPreviousSection();
      if (newPos === null) break;
      currentPos = newPos;
    }
    if (text[currentPos.sectionIndex][currentPos.textIndex - 1] === '\n') {
      break;
    }
    currentPos = currentPos.backtrackInSectionAndInLine(1);
  }

  return currentPos;
}

function indent(multilineString: string, amount: number): string {
  return multilineString.split('\n').map(line => ' '.repeat(amount) + line).join('\n');
}
