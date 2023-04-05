import { strict as assert } from 'node:assert';
import { indentMultilineString } from '../util';
import { createValidatorAssertionError, ValidatorAssertionError } from '../exceptions';

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
 * Calls the provided callback. If a ValidatorAssertionError is thrown during its execution,
 * the error is captured and returned.
 */
export function captureValidatorAssertionError(fn: () => unknown): ValidatorAssertionError | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof ValidatorAssertionError) {
      return error;
    }
    throw error;
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
    throw createValidatorAssertionError(variantErrorMessages[0]);
  }

  return createValidatorAssertionError(
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
