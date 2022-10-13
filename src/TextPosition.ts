// When parsing a template string, the arguments come in as a list of strings.
// Between the list entries are where values are interpolated into the string.
// In this module, this list of strings is referred to as "sections".

import { strict as assert } from 'node:assert';

interface TextPositionData {
  readonly sectionIndex: number
  readonly textIndex: number
  readonly lineNumb: number
  readonly colNumb: number
}

export interface TextRange {
  readonly start: TextPosition
  readonly end: TextPosition
}

/// A TextPosition generally points at a character, but it can point after the
/// end of a section. This is intended to represent "pointing at an interpolation point",
/// and anything fetching the character it points to might receive this if the textPosition
/// is in this state.
export const INTERPOLATION_POINT = Symbol('interpolation point');

/// A TextPosition generally points at a character, but it can point after the
/// end of the last section. This is intended to represent "pointing at the end of the text",
/// and anything fetching the character it points to might receive this if the textPosition
/// is in this state.
export const END_OF_TEXT = Symbol('end of text');

/// Represents something that a textPosition might be pointing at.
export type PointedAt = string | typeof INTERPOLATION_POINT | typeof END_OF_TEXT;

/// Same as `PointedAt`, except without the end-of-text symbol.
export type ContentPointedAt = string | typeof INTERPOLATION_POINT;

export class TextPosition {
  readonly #sections: readonly string[];
  readonly sectionIndex: number;
  readonly textIndex: number;
  // These are 1-based
  readonly lineNumb: number;
  readonly colNumb: number;

  constructor(sections: readonly string[], posData: TextPositionData) {
    this.#sections = sections;
    this.sectionIndex = posData.sectionIndex;
    this.textIndex = posData.textIndex;
    this.lineNumb = posData.lineNumb;
    this.colNumb = posData.colNumb;
    Object.freeze(this);
  }

  static atStartPos(sections: readonly string[]): TextPosition {
    return new TextPosition(sections, {
      sectionIndex: 0,
      textIndex: 0,
      lineNumb: 1,
      colNumb: 1,
    });
  }

  getChar(): string | typeof INTERPOLATION_POINT | typeof END_OF_TEXT {
    if (this.atEndOfText()) return END_OF_TEXT;
    if (this.atEndOfSection()) return INTERPOLATION_POINT;
    return this.#sections[this.sectionIndex][this.textIndex];
  }

  /// Move the textPosition instance forwards by the provided amount.
  /// Does not support jumping the textPosition from one section to another.
  /// This is an O(n) operation
  advanceInSection(amount: number): TextPosition {
    return this.#advanceInSection(amount);
  }

  /// Move the textPosition to the end of the section, which puts it at the index right
  /// after the last available character.
  /// This is an O(n) operation (where `n` is the value of amount)
  advanceToSectionEnd(): TextPosition {
    return this.#advanceInSection(this.#sections[this.sectionIndex].length - this.textIndex);
  }

  #advanceInSection(amount: number): TextPosition {
    let lineNumb = this.lineNumb;
    let colNumb = this.colNumb;
    for (let i = 0; i < amount; ++i) {
      const c = this.#sections[this.sectionIndex][this.textIndex + i];
      // It is not an error to have a textPosition pointing one past the current section.
      // It is, however, an error to try and advance when the textPosition is in this state.
      assert(c !== undefined, 'Attempted to advance a text-position past the length of a section.');

      if (c === '\n') {
        lineNumb++;
        colNumb = 1;
      } else {
        colNumb++;
      }
    }
    return new TextPosition(this.#sections, {
      sectionIndex: this.sectionIndex,
      textIndex: this.textIndex + amount,
      lineNumb,
      colNumb,
    });
  }

  /// Move the textPosition instance forwards by the provided amount.
  /// This is an O(n) operation (where `n` is the value of amount)
  advance(amount: number): TextPosition {
    let currentPos: TextPosition = this as TextPosition;
    for (let i = 0; i < amount; ++i) {
      if (this.atEndOfSection()) {
        const nextPos = this.advanceToNextSection(); // TODO: Should this be done in a while loop
        assert(nextPos !== null);
        currentPos = nextPos;
      } else {
        currentPos = this.#advanceInSection(1);
      }
    }
    return currentPos;
  }

  /// Moves forward through the text, yielding each position, one at a time.
  * iterForwards(): Generator<TextPosition> {
    let currentPos = this as TextPosition;
    while (true) {
      yield currentPos;
      if (currentPos.atEndOfText()) {
        break;
      }
      currentPos = currentPos.advance(1);
    }
  }

  /// Moves the text-position backwards.
  /// Does not support moving across sections or new lines.
  /// This is an O(n) operation (where `n` is the value of amount)
  backtrackInSectionAndInLine(amount: number): TextPosition {
    let colNumb = this.colNumb;
    for (let i = 0; i < amount; ++i) {
      const c = this.#sections[this.sectionIndex][this.textIndex - i - 1];
      assert(c !== undefined, 'Attempted to backtrack a text-position before the beginning of a section.');
      assert(c !== '\n', 'Attempted to backtrack a text-position across a new line.');

      colNumb--;
    }
    return new TextPosition(this.#sections, {
      sectionIndex: this.sectionIndex,
      textIndex: this.textIndex - amount,
      lineNumb: this.lineNumb,
      colNumb,
    });
  }

  /// Moves the textPosition to the start of the next section
  advanceToNextSection(): TextPosition | null {
    if (this.sectionIndex + 1 === this.#sections.length) {
      return null;
    } else {
      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex + 1,
        textIndex: 0,
        lineNumb: this.lineNumb,
        colNumb: this.colNumb,
      });
    }
  }

  /// Moves the textPosition to the end of the previous section
  backtrackToPreviousSection(): TextPosition | null {
    if (this.sectionIndex === 0) {
      return null;
    } else {
      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex - 1,
        textIndex: this.#sections[this.sectionIndex - 1].length,
        lineNumb: this.lineNumb,
        colNumb: this.colNumb,
      });
    }
  }

  atStartOfSection(): boolean {
    return this.textIndex === 0;
  }

  atEndOfSection(): boolean {
    return this.textIndex === this.#sections[this.sectionIndex].length;
  }

  atEndOfText(): boolean {
    return (
      this.sectionIndex === this.#sections.length - 1 &&
      this.textIndex === this.#sections[this.sectionIndex].length
    );
  }

  lessThan(other: TextPosition): boolean {
    if (this.sectionIndex < other.sectionIndex) return true;
    if (this.sectionIndex === other.sectionIndex) return this.textIndex < other.textIndex;
    return false;
  }

  equals(other: TextPosition): boolean {
    return this.sectionIndex === other.sectionIndex && this.textIndex === other.textIndex;
  }
}
