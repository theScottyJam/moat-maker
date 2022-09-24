/* eslint-disable no-extend-native */

import { MatcherProtocol } from './types/matcherProtocol';
import { ValidatorAssertionError } from './exceptions';
import { reprUnknownValue } from './util';

export const matcher = Symbol('validator matcher');

export function conformsToMatcherProtocol(value: unknown): value is MatcherProtocol {
  return matcher in Object(value);
}

export function installProtocolOnBuiltins(): void {
  Function.prototype[matcher] = function(value: unknown, path: string) {
    if (Object(value).constructor !== this) {
      throw new ValidatorAssertionError(
        `Expected ${path}, which is ${reprUnknownValue(value)} to match ${reprUnknownValue(this)} ` +
        '(via its matcher protocol).',
      );
    }
  };
}
