import { parse, freezeRule } from './ruleParser';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parseRules';
import { matcher, installProtocolOnBuiltins } from './matcherProtocol';
import type { Validator } from './types/validator';
import type { MatcherProtocol, MatcherProtocolFn } from './types/matcherProtocol';
import { reprUnknownValue } from './util';
import { ValidatorAssertionError } from './exceptions';

export * from './exceptions';
export * from './types/parseRules';
export * from './types/matcherProtocol';
export { Validator };

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
    [matcher](value: unknown, path: string) {
      assertMatches(rule, value, interpolated, path);
    },
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

  [matcher](value: unknown, path: string): void {
    if (!this.#callback(value)) {
      // TODO: Duplicate error message. (Also, it might be nice to just say `to match a custom matcher function` or something)
      throw new ValidatorAssertionError(
        `Expected ${path}, which is ${reprUnknownValue(value)} to match ${reprUnknownValue(this)} ` +
        '(via its matcher protocol).',
      );
    }
  }
}

validator.createMatcher = function(callback: (valueBeingMatched: unknown) => boolean): any {
  return new CustomMatcher(callback);
};

validator.matcher = matcher;

installProtocolOnBuiltins();
