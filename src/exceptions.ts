import { strict as assert } from 'node:assert';
import type { TextRange } from './types/tokenizer';

export class ValidatorAssertionError extends Error {
  name = 'ValidatorAssertionError';
}

export class ValidatorSyntaxError extends Error {
  name = 'ValidatorSyntaxError';
  constructor(message: string, rawText?: readonly string[], range?: TextRange) {
    super(ValidatorSyntaxError.#formatMessage(message, rawText, range));
  }

  static #formatMessage(message: string, rawText?: readonly string[], range?: TextRange): string {
    if (rawText === undefined || range === undefined) {
      assert(rawText === undefined && range === undefined);
      return message;
    }

    assert(range.start.lineNumb === range.end.lineNumb); // TODO: Formatting multi-line errors is not supported yet.
    const underlineLength = Math.max(range.end.colNumb - range.start.colNumb, 1);
    return [
      `${message} (line ${range.start.lineNumb}, col ${range.start.colNumb})`,
      '  ' + rawText.join(''),
      // `- 1` because colNum is 1-indexed, and `+ 2` for the indentation
      ' '.repeat(range.start.colNumb - 1 + 2) + '~'.repeat(underlineLength),
    ].join('\n');
  }
}
