import { strict as assert } from 'node:assert';
import { TextRange } from './TextPosition';
import { generateMessageWithPosition } from './errorFormatter';

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

    if (rawText !== undefined) assert(range !== undefined);
    const fullMessage = rawText === undefined || range === undefined
      ? message
      : generateMessageWithPosition(message, rawText, range);

    super(fullMessage);
  }
}

export function createValidatorSyntaxError(message: string, rawText?: readonly string[], range?: TextRange): ValidatorSyntaxError {
  return new ValidatorSyntaxError(validatorSyntaxErrorConstructorKey, message, rawText, range);
}
