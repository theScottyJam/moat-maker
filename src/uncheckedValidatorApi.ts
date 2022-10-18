// This module contains a minimal subset of the full validator API.
// The main difference is that it does not verify that its exported functions are receiving valid arguments at runtime.
// This is done because the real validator API both builds on this to implement its functionality,
// and it uses it to perform its user-input validation.

import { parse } from './ruleParser';
import { freezeRule } from './ruleFreezer';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parsingRules';
import { validatable } from './validatableProtocol';
import { isValidatorInstance, Validator, ValidatorRef } from './types/validator';
import type { ValidatableProtocol, ValidatableProtocolFn, ValidatableProtocolFnOpts } from './types/validatableProtocol';
import { reprUnknownValue } from './util';
import { ValidatorAssertionError } from './exceptions';

export function uncheckedValidator<T=unknown>(
  parts: TemplateStringsArray | { readonly raw: readonly string[] },
  ...interpolated: readonly unknown[]
): Validator<T> {
  return fromRule<T>(parse(parts.raw), interpolated);
}

uncheckedValidator.fromRule = function<T=unknown>(rule: Rule, interpolated: readonly unknown[] = []): Validator<T> {
  return fromRule<T>(freezeRule(rule), interpolated);
};

function fromRule<T=unknown>(rule: Rule, interpolated: readonly unknown[] = []): Validator<T> {
  return Object.freeze({
    [isValidatorInstance]: true as const,
    assertMatches(value: unknown): T {
      assertMatches(rule, value, interpolated);
      return value as any;
    },
    // Same as assertMatches(), except with a different type signature, and
    // returns void. Functions with assertion signatures have stricter rules
    // about when and how they can be used, and they can't be programmed to
    // return a value, which is why this is placed in a separate function.
    // If you're not using TypeScript, its recommended to simply ignore this.
    assertionTypeGuard(value: unknown): asserts value is T {
      assertMatches(rule, value, interpolated);
    },
    matches(value: unknown): value is T {
      return doesMatch(rule, value, interpolated);
    },
    rule,
    interpolated: Object.freeze(interpolated),
    [validatable](value: unknown, { failure, at }: ValidatableProtocolFnOpts) {
      // TODO: It would be better to pass in the failure function, instead of catching and rethrowing
      try {
        assertMatches(rule, value, interpolated, at);
      } catch (err) {
        if (err instanceof ValidatorAssertionError) {
          throw failure(err.message);
        } else {
          throw err;
        }
      }
    },
  });
}
