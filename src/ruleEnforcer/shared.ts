import { packagePrivate } from '../packagePrivateAccess';
import type { Expectation, Validator, ValidatorRef } from '../types/validator';

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
