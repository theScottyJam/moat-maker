import { parse } from './ruleParser';
import { freezeRule } from './ruleFreezer';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parsingRules';
import { validatable } from './validatableProtocol';
import { isValidatorInstance, Validator, ValidatorRef } from './types/validator';
import type { ValidatableProtocol, ValidatableProtocolFn } from './types/validatableProtocol';
import { reprUnknownValue, FrozenMap as FrozenMapClass } from './util';
import { ValidatorAssertionError, ValidatorSyntaxError } from './exceptions';

export { ValidatorAssertionError, ValidatorSyntaxError };
export * from './types/parsingRules';
export * from './types/validatableProtocol';
export type { Validator };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;

export function validator<T=unknown>(
  parts: TemplateStringsArray | { readonly raw: readonly string[] },
  ...interpolated: readonly unknown[]
): Validator<T> {
  return fromRule<T>(parse(parts.raw), interpolated);
}

validator.fromRule = function<T=unknown>(rule: Rule, interpolated: readonly unknown[] = []): Validator<T> {
  return fromRule<T>(freezeRule(rule), interpolated);
};

function fromRule<T=unknown>(rule: Rule, interpolated: readonly unknown[] = []): Validator<T> {
  return Object.freeze({
    [isValidatorInstance]: true as const,
    assertMatches(value: unknown): T {
      assertMatches(rule, value, interpolated);
      return value as T;
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
    [validatable](value: unknown, lookupPath: string) {
      assertMatches(rule, value, interpolated, lookupPath);
    },
  });
}

validator.from = function(unknownValue: string | Validator): Validator {
  if (typeof unknownValue === 'string') {
    return validator({ raw: [unknownValue] });
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

interface CustomValidatable extends ValidatableProtocol {
  protocolFn: ValidatableProtocolFn
}

validator.createValidatable = function(callback: (valueBeingMatched: unknown) => boolean, opts: { to?: string } = {}): CustomValidatable {
  const protocolFn = (value: unknown, lookupPath: string): void => {
    if (!callback(value)) {
      const endOfError = opts.to === undefined
        ? 'to match a custom validatable.'
        : `to ${opts.to}`;

      throw new ValidatorAssertionError(
        `Expected ${lookupPath}, which is ${reprUnknownValue(value)}, ${endOfError}`,
      );
    }
  };

  return {
    [validatable]: protocolFn,

    /**
     * Provides easy access to the protocol value, for use-cases where you want
     * to copy it out and put it on a different object.
     */
    protocolFn,
  };
};

validator.validatable = validatable;
