import { ValidatorAssertionError } from '../exceptions';
import { packagePrivate } from '../packagePrivateAccess';
import type { Expectation, Validator, ValidatorRef } from '../types/validator';
import { assert, indentMultilineString } from '../util';

export function isValidator(value: unknown): value is Validator {
  return Object(value)[packagePrivate]?.type === 'validator';
}

export function isRef(value: unknown): value is ValidatorRef {
  return Object(value)[packagePrivate]?.type === 'ref';
}

export function isExpectation(value: unknown): value is Expectation {
  return Object(value)[packagePrivate]?.type === 'expectation';
}

/**
 * Similar to `typeof`, but it correctly handles `null`, and it treats functions as objects.
 * This tries to mimic how TypeScript compares simple types.
 */
export function getSimpleTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  } else if (typeof value === 'function') {
    return 'object';
  } else {
    return typeof value;
  }
}

/**
 * Turns a list of errors into a single union-style error.
 * Duplicate messages are automatically filtered out.
 */
export function buildUnionError(variantErrorMessages_: readonly string[]): ValidatorAssertionError {
  const variantErrorMessages = unique(variantErrorMessages_);
  if (variantErrorMessages.length === 1) {
    assert(variantErrorMessages[0] !== undefined);
    return new ValidatorAssertionError(variantErrorMessages[0]);
  }

  return new ValidatorAssertionError(
    'Failed to match against any variant of a union.\n' +
    variantErrorMessages
      .map((message, i) => `  Variant ${i + 1}: ${indentMultilineString(message, 4).slice(4)}`)
      .join('\n'),
  );
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function unique<T>(array: readonly T[]): readonly T[] {
  return [...new Set(array)];
}
