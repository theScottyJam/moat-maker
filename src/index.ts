import { parse, freezeRule } from './ruleParser';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parseRules';
import { matcher, installProtocolOnBuiltins } from './matcherProtocol';
import type { Validator } from './types/validator';
import type { MatcherProtocol, MatcherProtocolFn } from './types/matcherProtocol';

export * from './exceptions';
export * from './types/parseRules';
export * from './types/matcherProtocol';

export function validator(parts: TemplateStringsArray, ...interpolated: readonly unknown[]): Validator {
  return validator.fromRule(parse(parts), interpolated);
}

validator.fromRule = function(rule_: Rule, interpolated: readonly unknown[] = []): Validator {
  const rule = freezeRule(rule_);

  return Object.freeze({
    assertMatches<T>(value: T): T {
      return assertMatches(rule, value, interpolated);
    },
    matches(value: unknown) {
      return doesMatch(rule, value, interpolated);
    },
    rule,
    interpolated: Object.freeze(interpolated),
  });
};

class CustomMatcher implements MatcherProtocol {
  #callback;

  /// Provides easy access to the protocol value, for use-cases where you want
  /// to copy it out and put it on a different object.
  matcher: MatcherProtocolFn;

  constructor(callback: (valueBeingMatched: unknown) => boolean) {
    this.#callback = callback;
    this.matcher = this[matcher];
  }

  [matcher](valueBeingMatched: unknown): ReturnType<MatcherProtocolFn> {
    return {
      matched: this.#callback(valueBeingMatched),
      value: undefined,
    };
  }
}

validator.createMatcher = function(callback: (valueBeingMatched: unknown) => boolean): any {
  return new CustomMatcher(callback);
};

validator.matcher = matcher;

installProtocolOnBuiltins();
