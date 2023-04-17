import { strict as assert } from 'node:assert';
import { createValidatorAssertionError, type ValidatorAssertionError } from '../exceptions';
import { indentMultilineString } from '../util';

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

// <-- Move to shared.ts?
/**
 * Turns a list of errors into a single union-style error.
 * Duplicate messages are automatically filtered out.
 */
export function buildUnionError(variantErrorMessages_: readonly string[]): ValidatorAssertionError {
  const variantErrorMessages = unique(variantErrorMessages_);
  if (variantErrorMessages.length === 1) {
    assert(variantErrorMessages[0] !== undefined);
    return createValidatorAssertionError(variantErrorMessages[0]);
  }

  return createValidatorAssertionError(
    'Failed to match against any variant of a union.\n' +
    variantErrorMessages
      .map((message, i) => `  Variant ${i + 1}: ${indentMultilineString(message, 4).slice(4)}`)
      .join('\n'),
  );
}

/**
 * When an error occurs, it can be assigned a "deepness level", to describe how deep of an issue the error is.
 * This is to help remove irrelevant information from union errors. When combining together various union variant failures
 * into a single error message, only those with the highest deepness level are considered.
 *
 * This, for example, makes it so if you have the pattern `{ x: 2 } | 3`, and a `{ x: 4 }` object got passed in,
 * only the error about how "<receivedValue>.x should be 3" will be shown, the error about how the whole value should
 * be the number three will be omitted.
 *
 * It's important to prune errors like these down, because in recursive union definitions, the number of failed
 * variants can quickly grow to astronomical numbers.
 */
export const DEEP_LEVELS = {
  // Used by top-level checks, where the deepness level doesn't really matter.
  irrelevant: -1,
  // TODO
  // The code isn't yet factored in a way where it's easy to assign deepness levels to all the different kinds of failures.
  // Unorganized ones are currently assigned this number. When we have more control, we'll remove this option, and update
  // the numbering of some of the other options to do more pruning (it's hard to prune errors to aggressively while we have
  // a big lump category like this)
  unorganized: 0,
  // This is specifically used for the "is this value an instance of an Object" type check.
  // This category is separate from the normal "typeCheck" category, because you can run into scenarios where a value
  // is an object, but more specifically, it's an array, so you don't really care about the object checks if there were
  // array checks happening in the union as well.
  nonSpecificTypeCheck: 0,
  // Any sort of general type-checking
  typeCheck: 0,
  // Checks about information about the value that is readily available
  // (i.e. you don't have to recurse into a nested data structure to verify the info)
  immediateInfoCheck: 1,
  // Information that requires you to recurse into a nested data structure.
  recurseInwardsCheck: 2,
};

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function unique<T>(array: readonly T[]): readonly T[] {
  return [...new Set(array)];
}
