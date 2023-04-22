import { strict as assert } from 'node:assert';
import type { TextRange } from './TextPosition';
import { generateMessageWithPosition } from './errorFormatter';

const ExceptionConstructionKey = Symbol('exception constructor key');

/**
 * Only used internally.
 * This will be translated into another error type, like a TypeError,
 * before API users see it.
 */
export class ValidatorAssertionError extends Error {
  name = 'ValidatorAssertionError';
}

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
