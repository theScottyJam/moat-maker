/* eslint-disable no-extend-native */

import { ValidatableProtocol } from './types/validatableProtocol';
import { ValidatorAssertionError } from './exceptions';
import { reprUnknownValue } from './util';

export const validatable = Symbol('validatable');

export function conformsToValidatableProtocol(value: unknown): value is ValidatableProtocol {
  return validatable in Object(value);
}

export function installProtocolOnBuiltins(): void {
  Function.prototype[validatable] = function(value: unknown, lookupPath: string) {
    if (Object(value).constructor !== this) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath}, which is ${reprUnknownValue(value)}, to match ${reprUnknownValue(this)} ` +
        '(via its validatable protocol).',
      );
    }
  };
}
