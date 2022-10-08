import { strict as assert } from 'node:assert';
import type { TextRange } from './types/tokenizer';

export class ValidatorAssertionError extends Error {
  name = 'ValidatorAssertionError';
}

const validatorSyntaxErrorConstructorKey = Symbol('validatorSyntaxError constructor key');

export class ValidatorSyntaxError extends Error {
  name = 'ValidatorSyntaxError';
  constructor(
    key: typeof validatorSyntaxErrorConstructorKey,
    message: string,
    rawText?: readonly string[],
    range?: TextRange,
  ) {
    if (key !== validatorSyntaxErrorConstructorKey) {
      throw new Error('The ValidatorSyntaxError constructor is private.');
    }
    super(ValidatorSyntaxError.#formatMessage(message, rawText, range));
  }

  static #formatMessage(message: string, rawText?: readonly string[], range?: TextRange): string {
    if (rawText === undefined || range === undefined) {
      assert(rawText === undefined && range === undefined);
      return message;
    }

    return [
      `${message} (line ${range.start.lineNumb}, col ${range.start.colNumb})`,
      indent(
        underlineRange(rawText, range),
        2,
      ),
    ].join('\n');
  }
}

export function createValidatorSyntaxError(message: string, rawText?: readonly string[], range?: TextRange): ValidatorSyntaxError {
  return new ValidatorSyntaxError(validatorSyntaxErrorConstructorKey, message, rawText, range);
}

// ----- HELPERS ----- //

function underlineRange(text: readonly string[], range: TextRange): string {
  const joinedText = text.join('');

  let index = range.start.textIndex - (range.start.colNumb - 1);
  let textBeingUnderlined = '';
  let underline = '';
  while (true) {
    const char = joinedText[index];

    if (char === undefined || char === '\n') {
      if (index === range.start.textIndex) {
        underline += '~';
      }
      break;
    }

    if (textBeingUnderlined.length === 0 && /\s/.exec(char) !== null) {
      // ignore initial indentation
    } else {
      textBeingUnderlined += char;
      if (index < range.start.textIndex) {
        underline += ' ';
      } else if (index < range.end.textIndex) {
        underline += '~';
      }
    }

    index++;
  }

  return [
    textBeingUnderlined.trimEnd(),
    underline,
  ].join('\n');
}

function indent(multilineString: string, amount: number): string {
  return multilineString.split('\n').map(line => ' '.repeat(amount) + line).join('\n');
}
