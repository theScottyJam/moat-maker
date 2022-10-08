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

  advanceInSection(amount: number): TextPosition {
    return this.#advanceInSegment(amount);
  }

  advanceToSegmentEnd(): TextPosition {
    return this.#advanceInSegment(this.#sections[this.sectionIndex].length - this.textIndex);
  }

  #advanceInSegment(amount: number): TextPosition {
    let lineNumb = this.lineNumb;
    let colNumb = this.colNumb;
    for (let i = 0; i < amount; ++i) {
      const c = this.#sections[this.sectionIndex][this.textIndex + i];
      assert(c !== undefined, 'Attempted to advance a text-position past the length of a segment.');

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

  atEndOfSegment(): boolean {
    return this.textIndex === this.#sections[this.sectionIndex].length;
  }
}
