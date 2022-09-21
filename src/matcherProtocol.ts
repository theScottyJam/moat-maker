/* eslint-disable no-extend-native */

export const matcher = Symbol('validator matcher');

interface MatcherProtocol {
  [matcher]: (value: unknown) => {
    matched: boolean
    value: unknown
  }
}

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
