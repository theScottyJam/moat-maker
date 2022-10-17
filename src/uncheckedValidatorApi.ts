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
import type { ValidatableProtocol, ValidatableProtocolFn } from './types/validatableProtocol';
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
      // There is currently no way to tell TypeScript that assertMatches() both asserts the input
      // and returns a value. Because of this, TypeScript wants this function to return void, but we're returning
      // the value anyways as a convenience for any JavaScript users who aren't constrained by TypeScript's rules.
      return value as any;
    },
    // Same as assertMatches(), except with a different type signature.
    // If you're not using TypeScript, its recommended to simply ignore this.
    // If TypeScript ever gets around to allowing these two type signatures to be combined,
    // this version will be marked as deprecated in favor of assertMatches() (but it won't be removed).
    // See https://github.com/microsoft/TypeScript/issues/34636
    assertionTypeGuard(value: unknown): asserts value is T {
      assertMatches(rule, value, interpolated);
    },
    matches(value: unknown): value is T {
      return doesMatch(rule, value, interpolated);
    },
    rule,
    interpolated: Object.freeze(interpolated),
    [validatable](value: unknown, lookupPath: string) {
      assertMatches(rule, value, interpolated, lookupPath);
    },
  });
}
