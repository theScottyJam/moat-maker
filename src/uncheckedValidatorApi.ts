// This module contains a minimal subset of the full validator API.
// The main difference is that it does not verify that its exported functions are receiving valid arguments at runtime.
// This is done because the real validator API both builds on this to implement its functionality,
// and it uses it to perform its user-input validation.

import { parse } from './ruleParser';
import { freezeRule } from './ruleFreezer';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parsingRules';
import { validatable } from './validatableProtocol';
import { AssertMatchesOpts, isValidatorInstance, Validator } from './types/validator';
import type { ValidatableProtocolFnOpts } from './types/validatableProtocol';
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
    assertMatches(value: unknown, opts?: AssertMatchesOpts): T {
      if (opts?.errorPrefix?.endsWith(':') === false) {
        throw new TypeError('The assertMatches() errorPrefix string must end with a colon.');
      }

      try {
        assertMatches(rule, value, interpolated, opts);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          throw new TypeError(...buildTypeErrorArgs(error, opts));
        }
        throw error;
      }

      return value as any;
    },
    // Same as assertMatches(), except with a different type signature, and
    // returns void. Functions with assertion signatures have stricter rules
    // about when and how they can be used, and they can't be programmed to
    // return a value, which is why this is placed in a separate function.
    // If you're not using TypeScript, its recommended to simply ignore this.
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      if (opts?.errorPrefix?.endsWith(':') === false) {
        throw new TypeError('The assertionTypeGuard() errorPrefix string must end with a colon.');
      }

      try {
        assertMatches(rule, value, interpolated, opts);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          throw new TypeError(...buildTypeErrorArgs(error, opts));
        }
        throw error;
      }
    },
    assertArgs(whichFn: string, args: ArrayLike<unknown>) {
      const opts = {
        errorPrefix: `received invalid argument for ${whichFn}():`,
        at: '<argumentList>',
      };

      try {
        assertMatches(rule, Array.from(args), interpolated, opts);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          throw new TypeError(...buildTypeErrorArgs(error, opts));
        }
        throw error;
      }
    },
    matches(value: unknown): value is T {
      return doesMatch(rule, value, interpolated);
    },
    rule,
    interpolated: Object.freeze(interpolated),
    [validatable](value: unknown, { failure, at }: ValidatableProtocolFnOpts) {
      assertMatches(rule, value, interpolated, { at, errorFactory: failure });
    },
  });
}

function buildTypeErrorArgs(error: ValidatorAssertionError, opts: AssertMatchesOpts | undefined): any {
  const prefix = opts?.errorPrefix !== undefined ? opts.errorPrefix + ' ' : '';
  // This version of TypeScript does not yet support error causes.
  const errorOpts = (error as any).cause !== undefined
    ? { cause: (error as any).cause }
    : [];
  return [prefix + error.message, errorOpts];
}
