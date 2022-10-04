import { parse } from './ruleParser';
import { freezeRule } from './ruleFreezer';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parseRules';
import { validatable } from './validatableProtocol';
import { isValidatorInstance, Validator, ValidatorRef } from './types/validator';
import type { ValidatableProtocol, ValidatableProtocolFn } from './types/validatableProtocol';
import { reprUnknownValue, FrozenMap as FrozenMapClass } from './util';
import { ValidatorAssertionError, ValidatorSyntaxError } from './exceptions';

export { ValidatorAssertionError, ValidatorSyntaxError };
export * from './types/parseRules';
export * from './types/validatableProtocol';
export type { Validator };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;

export function validator(parts: TemplateStringsArray | readonly string[], ...interpolated: readonly unknown[]): Validator {
  return fromRule(parse(parts), interpolated);
}

validator.fromRule = function(rule: Rule, interpolated: readonly unknown[] = []): Validator {
  return fromRule(freezeRule(rule));
};

function fromRule(rule: Rule, interpolated: readonly unknown[] = []): Validator {
  return Object.freeze({
    [isValidatorInstance]: true as const,
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
}

validator.from = function(unknownValue: string | Validator): Validator {
  if (typeof unknownValue === 'string') {
    return validator([unknownValue]);
  } else if (Object(unknownValue)[isValidatorInstance] === true) {
    return unknownValue;
  } else {
    throw new Error('Unexpected input value'); // TODO: Test
  }
};

validator.createRef = function(): ValidatorRef {
  let validator: Validator | null = null;
  return {
    [validatable](...args: Parameters<ValidatableProtocolFn>) {
      if (validator === null) {
        throw new Error('Can not use a pattern with a ref until ref.set(...) has been called.');
      }
      return validator[validatable](...args);
    },
    set(validator_: Validator) {
      if (validator !== null) {
        throw new Error('Can not call ref.set(...) multiple times.');
      }
      if (Object(validator_)[isValidatorInstance] !== true) {
        throw new Error(
          'Must call ref.set(...) with a validator instance. ' +
          `Received the non-validator ${reprUnknownValue(validator_)}.`,
        );
      }
      validator = validator_;
    },
  };
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
