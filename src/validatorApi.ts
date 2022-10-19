import { Rule } from './types/parsingRules';
import { validatable } from './validatableProtocol';
import { AssertMatchesOpts, isValidatorInstance, Validator, ValidatorRef } from './types/validator';
import type { ValidatableProtocol, ValidatableProtocolFn, ValidatableProtocolFnOpts } from './types/validatableProtocol';
import { reprUnknownValue } from './util';
import { uncheckedValidator } from './uncheckedValidatorApi';
import { ValidatorAssertionError } from './exceptions';

export function validator<T=unknown>(
  parts: TemplateStringsArray | { readonly raw: readonly string[] },
  ...interpolated: readonly unknown[]
): Validator<T> {
  // eslint-disable-next-line prefer-rest-params
  uncheckedValidator`[parts: { raw: string[] }, ...interpolated: unknown[]]`.assertMatches([...arguments]);
  return wrapValidatorWithUserInputChecks(uncheckedValidator(parts, ...interpolated));
}

validator.fromRule = function<T=unknown>(rule: Rule, interpolated: readonly unknown[] = []): Validator<T> {
  return wrapValidatorWithUserInputChecks(uncheckedValidator.fromRule<T>(rule, interpolated));
};

function wrapValidatorWithUserInputChecks<T>(unwrappedValidator: Validator<T>): Validator<T> {
  return Object.freeze({
    [isValidatorInstance]: true as const,
    assertMatches(value: unknown, opts?: AssertMatchesOpts): T {
      try {
        return unwrappedValidator.assertMatches(value, opts);
      } catch (error) {
        // Rethrow as TypeError as low down the call stack as possible, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          // This version of TypeScript does not yet support error causes.
          const errorOpts = (error as any).cause !== undefined
            ? { cause: (error as any).cause }
            : undefined;
          throw new (TypeError as any)(error.message, errorOpts);
        }
        throw error;
      }
    },
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      try {
        return unwrappedValidator.assertionTypeGuard(value, opts);
      } catch (error) {
        // Rethrow as TypeError as low down the call stack as possible, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          // This version of TypeScript does not yet support error causes.
          const errorOpts = (error as any).cause !== undefined
            ? { cause: (error as any).cause }
            : undefined;
          throw new (TypeError as any)(error.message, errorOpts);
        }
        throw error;
      }
    },
    matches(value: unknown): value is T {
      return unwrappedValidator.matches(value);
    },
    rule: unwrappedValidator.rule,
    interpolated: unwrappedValidator.interpolated,
    [validatable](value: unknown, opts: ValidatableProtocolFnOpts) {
      return unwrappedValidator[validatable](value, opts);
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
  const protocolFn = (value: unknown, { failure, at: lookupPath }: ValidatableProtocolFnOpts): void => {
    if (!callback(value)) {
      const endOfError = opts.to === undefined
        ? 'to match a custom validatable.'
        : `to ${opts.to}`;

      throw failure(`Expected ${lookupPath}, which is ${reprUnknownValue(value)}, ${endOfError}`);
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
