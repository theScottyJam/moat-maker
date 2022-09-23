/* eslint-disable no-extend-native */

import { MatcherProtocol } from './types/matcherProtocol';

export const matcher = Symbol('validator matcher');

export function conformsToMatcherProtocol(value: unknown): value is MatcherProtocol {
  return matcher in Object(value);
}

export function installProtocolOnBuiltins(): void {
  Function.prototype[matcher] = function(value: unknown) {
    return {
      matched: Object(value).constructor === this,
      value: undefined,
    };
  };
}
