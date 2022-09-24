import { parse, freezeRule } from './ruleParser';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parseRules';
import { validatable, installProtocolOnBuiltins } from './validatableProtocol';
import type { Validator } from './types/validator';
import type { ValidatableProtocol, ValidatableProtocolFn } from './types/validatableProtocol';
import { reprUnknownValue } from './util';
import { ValidatorAssertionError } from './exceptions';

export * from './exceptions';
export * from './types/parseRules';
export * from './types/validatableProtocol';
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
    [validatable](value: unknown, lookupPath: string) {
      assertMatches(rule, value, interpolated, lookupPath);
    },
  });
};

class CustomValidatable implements ValidatableProtocol {
  #callback;

  /// Provides easy access to the protocol value, for use-cases where you want
  /// to copy it out and put it on a different object.
  validatable: ValidatableProtocolFn;

  constructor(callback: (valueBeingMatched: unknown) => boolean) {
    this.#callback = callback;
    // TODO: Duplicate function
    this.validatable = function(this: unknown, value: unknown, lookupPath: string) {
      if (!callback(value)) {
        throw new ValidatorAssertionError(
          `Expected ${lookupPath}, which is ${reprUnknownValue(value)}, to match ${reprUnknownValue(this)} ` +
          '(via its validatable protocol).',
        );
      }
    };
  }

  [validatable](value: unknown, lookupPath: string): void {
    if (!this.#callback(value)) {
      // TODO: Duplicate error message. (Also, it might be nice to just say `to match a custom validator function` or something)
      throw new ValidatorAssertionError(
        `Expected ${lookupPath}, which is ${reprUnknownValue(value)}, to match ${reprUnknownValue(this)} ` +
        '(via its validatable protocol).',
      );
    }
  }
}

validator.createValidatable = function(callback: (valueBeingMatched: unknown) => boolean): CustomValidatable {
  return new CustomValidatable(callback);
};

validator.validatable = validatable;

installProtocolOnBuiltins();
