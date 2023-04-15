import type { ValidatableProtocol } from './types/validatableProtocol';

export const validatable = Symbol('validatable');

export function hasValidatableProperty(value: unknown): value is { [validatable]: unknown } {
  return validatable in Object(value);
}

export function assertConformsToValidatableProtocol(value: unknown): asserts value is ValidatableProtocol {
  if (!hasValidatableProperty(value) || typeof value[validatable] !== 'function') {
    throw new TypeError(
      'An invalid object was interpolated into a validator instance. ' +
      "It had a validator.validatable key who's value was not of type function.",
    );
  }
}
