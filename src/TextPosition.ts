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

/**
 * A TextPosition generally points at a character, but it can point after the
 * end of a section. This is intended to represent "pointing at an interpolation point",
 * and anything fetching the character it points to might receive this if the textPosition
 * is in this state.
 */
export const INTERPOLATION_POINT = Symbol('interpolation point');

/**
 * A TextPosition generally points at a character, but it can point after the
 * end of the last section. This is intended to represent "pointing at the end of the text",
 * and anything fetching the character it points to might receive this if the textPosition
 * is in this state.
 */
export const END_OF_TEXT = Symbol('end of text');

/** Represents something that a textPosition might be pointing at. */
export type PointedAt = string | typeof INTERPOLATION_POINT | typeof END_OF_TEXT;

/** Same as `PointedAt`, except without the end-of-text symbol. */
export type ContentPointedAt = string | typeof INTERPOLATION_POINT;

function throwIndexOutOfBounds(): never {
  throw new Error('Internal error: Attempted to index an array with an out-of-bounds index.');
}

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

  getChar(): PointedAt {
    return this.#getCharAt(this);
  }

  getPreviousChar(): PointedAt {
    if (this.textIndex === 0) {
      assert(this.sectionIndex !== 0, 'Internal error: Reached beginning of text');
      return this.#getCharAt({
        sectionIndex: this.sectionIndex - 1,
        textIndex: this.#sections[this.sectionIndex - 1]?.length ?? throwIndexOutOfBounds(),
      });
    } else {
      return this.#getCharAt({
        textIndex: this.textIndex - 1,
        sectionIndex: this.sectionIndex,
      });
    }
  }

  #getCharAt({ textIndex, sectionIndex }: { textIndex: number, sectionIndex: number }): PointedAt {
    const isLastSection = sectionIndex === this.#sections.length - 1;
    const endOfSection = textIndex >= (this.#sections[sectionIndex]?.length ?? throwIndexOutOfBounds());

    if (isLastSection && endOfSection) return END_OF_TEXT;
    if (endOfSection) return INTERPOLATION_POINT;
    return this.#sections[sectionIndex]?.[textIndex] ?? throwIndexOutOfBounds();
  }

  /**
   * Move the textPosition to the end of the section, which puts it at the index right
   * after the last available character.
   * This is an O(n) operation (where `n` is the value of amount)
   */
  advanceToSectionEnd(): TextPosition {
    let currentPos: TextPosition = this as TextPosition;
    while (currentPos.getChar() !== END_OF_TEXT && currentPos.getChar() !== INTERPOLATION_POINT) {
      currentPos = currentPos.#advanceOneUnit();
    }
    return currentPos;
  }

  /**
   * Move the textPosition instance forwards by the provided amount.
   * This is an O(n) operation (where `n` is the value of amount)
   */
  advance(amount: number): TextPosition {
    let currentPos: TextPosition = this as TextPosition;
    for (let i = 0; i < amount; ++i) {
      currentPos = currentPos.#advanceOneUnit();
    }
    return currentPos;
  }

  #advanceOneUnit(): TextPosition {
    if (this.textIndex === (this.#sections[this.sectionIndex]?.length ?? throwIndexOutOfBounds())) {
      // advance to next section
      assert(this.sectionIndex + 1 !== this.#sections.length, 'Internal error: Reached end of text');
      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex + 1,
        textIndex: 0,
        lineNumb: this.lineNumb,
        colNumb: this.colNumb,
      });
    } else {
      // advance within the current section
      let lineNumb = this.lineNumb;
      let colNumb = this.colNumb;

      const c = this.#sections[this.sectionIndex]?.[this.textIndex] ?? throwIndexOutOfBounds();
      if (c === '\n') {
        lineNumb++;
        colNumb = 1;
      } else {
        colNumb++;
      }

      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex,
        textIndex: this.textIndex + 1,
        lineNumb,
        colNumb,
      });
    }
  }

  /** Moves forward through the text, yielding each position, one at a time. */
  * iterForwards(): Generator<TextPosition> {
    let currentPos = this as TextPosition;
    while (true) {
      yield currentPos;
      if (currentPos.getChar() === END_OF_TEXT) {
        break;
      }
      currentPos = currentPos.advance(1);
    }
  }

  /**
   * Move the textPosition instance backwards by the provided amount.
   * This is an O(n) operation (where `n` is the value of amount)
   */
  backtrackInLine(amount: number): TextPosition {
    let currentPos: TextPosition = this as TextPosition;
    for (let i = 0; i < amount; ++i) {
      currentPos = currentPos.#backtrackOneUnitInLine();
    }
    return currentPos;
  }

  #backtrackOneUnitInLine(): TextPosition {
    if (this.textIndex === 0) {
      // backtrack to previous section
      assert(this.sectionIndex > 0, 'Internal error: Reached beginning of text');
      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex - 1,
        textIndex: this.#sections[this.sectionIndex - 1]?.length ?? throwIndexOutOfBounds(),
        lineNumb: this.lineNumb,
        colNumb: this.colNumb,
      });
    } else {
      // backtrack within current section
      const c = this.#sections[this.sectionIndex]?.[this.textIndex - 1] ?? throwIndexOutOfBounds();
      assert(c !== '\n', 'Attempted to backtrack a text-position across a new line.');

      return new TextPosition(this.#sections, {
        sectionIndex: this.sectionIndex,
        textIndex: this.textIndex - 1,
        lineNumb: this.lineNumb,
        colNumb: this.colNumb - 1,
      });
    }
  }

  // eslint-disable-next-line consistent-return
  static getSlice(start: TextPosition, end: TextPosition): readonly ContentPointedAt[] {
    const result: ContentPointedAt[] = [];
    for (const pos of start.iterForwards()) {
      if (pos.#equals(end)) {
        break;
      }

      const char = pos.getChar();
      assert(char !== END_OF_TEXT, 'Internal error: Reached end-of-text without hitting the end pos.');
      result.push(char);
    }
    return result;
  }

  atStartOfText(): boolean {
    return this.sectionIndex === 0 && this.textIndex === 0;
  }

  atInterpolationPoint(): boolean {
    return this.getChar() === INTERPOLATION_POINT;
  }

  atEndOfText(): boolean {
    return this.getChar() === END_OF_TEXT;
  }

  #equals(other: TextPosition): boolean {
    return this.sectionIndex === other.sectionIndex && this.textIndex === other.textIndex;
  }
}
