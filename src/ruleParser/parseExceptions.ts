import { assert } from '../util.js';
import type { TextRange } from './TextPosition.js';
import { generateMessageWithPosition } from './errorFormatter.js';

const ExceptionConstructionKey = Symbol('exception constructor key');

/**
 * An instance of this error is thrown whenever there's an issue in the syntax of your validation rules.
 */
export class ValidatorSyntaxError extends Error {
  name = 'ValidatorSyntaxError';
  constructor(
    key: typeof ExceptionConstructionKey,
    message: string,
    rawText?: readonly string[],
    range?: TextRange,
  ) {
    if (key !== ExceptionConstructionKey) {
      throw new Error('The ValidatorSyntaxError constructor is private.');
    }

    if (rawText !== undefined) assert(range !== undefined);
    const fullMessage = rawText === undefined || range === undefined
      ? message
      : generateMessageWithPosition(message, rawText, range);

    super(fullMessage);
  }
}

export function createValidatorSyntaxError(message: string, rawText?: readonly string[], range?: TextRange): ValidatorSyntaxError {
  return new ValidatorSyntaxError(ExceptionConstructionKey, message, rawText, range);
}
