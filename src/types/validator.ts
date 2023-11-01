import type { Ruleset } from './validationRules.js';
import { packagePrivate } from '../packagePrivateAccess.js';
import { expectDirectInstanceFactory, expectKeysFromFactory } from '../validationHelpers.js';
import { DISABLE_PARAM_VALIDATION } from '../config.js';

type ErrorFactoryFn = ((...params: ConstructorParameters<typeof Error>) => Error);

export interface AssertMatchesOpts {
  readonly errorFactory?: ErrorFactoryFn | undefined
  readonly at?: string | undefined
  readonly errorPrefix?: string | undefined
}

export function createAssertMatchesOptsCheck(validator: ValidatorTemplateTag): Validator {
  const expectDirectInstance = expectDirectInstanceFactory(validator);
  const expectKeysFrom = expectKeysFromFactory(validator);
  const andExpectEndsWithColon = validator.expectTo(value => {
    return (value as string).endsWith(':')
      ? undefined
      : 'end with a colon.';
  });
  return validator`{
    errorFactory?: undefined | ${expectDirectInstance(Function)}
    at?: undefined | string
    errorPrefix?: undefined | (string & ${andExpectEndsWithColon})
  } & ${expectDirectInstance(Object)} & ${expectKeysFrom(['errorFactory', 'at', 'errorPrefix'])}`;
}

export function wrapErrorFactoryFnWithAssertions(
  errorFactory: ErrorFactoryFn,
  fnName: string,
  validator: ValidatorTemplateTag,
): ErrorFactoryFn {
  return function errorFactoryAssertionWrapper(...args: ConstructorParameters<typeof Error>) {
    const result = errorFactory(...args);

    !DISABLE_PARAM_VALIDATION && validator`${Error}`.assertMatches(result, {
      errorFactory: (message_, ...etc) => {
        const message = [
          message_,
          '',
          'The errorFactory() callback was supposed to build an error instance for the following error:',
          args[0],
        ].join('\n');
        return new TypeError(message, ...etc);
      },
      errorPrefix: `${fnName} received a bad "errorFactory" function:`,
      at: '<errorFactory return value>',
    });

    return result;
  };
}

export interface Expectation {
  readonly [packagePrivate]: {
    readonly type: 'expectation'
    readonly testExpectation: (valueBeingMatched: unknown) => string | undefined
  }
}

export interface LazyEvaluator {
  readonly [packagePrivate]: {
    readonly type: 'lazyEvaluator'
    readonly deriveValidator: (value: unknown) => Validator
  }
}

export interface Validator<T=unknown> {
  readonly [packagePrivate]: { readonly type: 'validator' }
  /**
   * Expects any value as a parameter. Returns true if the provided value matches the validator.
   */
  readonly matches: (value: unknown) => value is T
  /**
   * Expects any value as a parameter. Throws a TypeError if the value fails to match the validator.
   * Returns the supplied argument as-is.
   */
  readonly assertMatches: (value: unknown, opts?: AssertMatchesOpts) => T
  /**
   * This function behaves exactly like validatorInstance.assertMatches(),
   * with the only exception being that it does not return anything.
   *
   * This function was given a different TypeScript type signature than .assertMatches().
   * .assertionTypeGuard() is declared with TypeScript's asserts keyword, allowing it to be used
   * for type-narrowing purposes. Keep in mind that there is a handful of restrictions on how
   * TypeScript assert functions can be used and what they can return, which is why this is
   * provided as a separate function.
   *
   * If you need type narrowing, use this function, if you don't, or if you're
   * not using TypeScript, use .assertMatches().
   */
  readonly assertionTypeGuard: (value: unknown, opts?: AssertMatchesOpts) => asserts value is T
  /**
   * When you wish to validate user input to your API functions, it is recommended to use this function,
   * as it is capable of providing more descriptive error messages than .assertMatches().
   */
  readonly assertArgs: (whichFn: string, args: ArrayLike<unknown>) => void
  /**
   * This contains the ruleset that the validator follows as it validates data.
   * This ruleset is generally the result of parsing the text provided in the validator template tag.
   */
  readonly ruleset: Ruleset
}

export interface ValidatorTemplateTagStaticFields {
  /**
   * This function expects a ruleset as a parameter and returns a new validator instance.
   */
  readonly fromRuleset: <T=unknown>(rule: Ruleset) => Validator<T>
  /**
   * If a validator instance is passed in, the same validator instance is returned.
   * If a string is passed in, the string will be parsed as a string containing validation rules,
   * and a new validator instance will be returned.
   */
  readonly from: (unknownValue: string | Validator) => Validator
  /**
   * This function allows you to lazily fetch or build a validator instance at the moment it's needed.
   * It expects a callback to be provided and will return a lazy evaluator (of type LazyEvaluator),
   * which can be interpolated into new validators.
   *
   * The callback accepts, as a parameter, the value it's in charge of validating.
   * It should return a validator instance, which will be used to validate the data.
   */
  readonly lazy: (deriveValidator: (value: unknown) => Validator) => LazyEvaluator
  /**
   * The validator.expectTo() function makes it easy to supply custom validation logic.
   * It expects a callback that returns an error string or null, depending on if your custom
   * condition is satisfied. validator.expectTo() returns an expectation instance (of type Expectation),
   * which can then be interpolated into a validator template.
   *
   * The error message string you return is expected to complete the sentence "Expect [the value] to ...".
   * End the phrase with a period, and if needed, you can add additional sentences afterward.
   */
  readonly expectTo: (callback: (valueBeingMatched: unknown) => string | undefined) => Expectation
  /**
   * Returns true if the provided value is a validator instance.
   */
  readonly isValidator: (value: unknown) => value is Validator
  /**
   * Returns true if the provided value is an Expectation instance.
   */
  readonly isExpectation: (value: unknown) => value is Expectation
  /**
   * Returns true if the provided value is a LazyEvaluator instance.
   */
  readonly isLazyEvaluator: (value: unknown) => value is LazyEvaluator
}

type Primitive = string | number | bigint | boolean | symbol | null | undefined;
export type InterpolatedValue = (
  Primitive
  | Validator
  | LazyEvaluator
  | Expectation
  | RegExp
  | (new (...params: any) => any)
);

export type ValidatorTemplateTag = ValidatorTemplateTagStaticFields & (
  <T>(
    parts: TemplateStringsArray,
    ...interpolated: readonly InterpolatedValue[]
  ) => Validator<T>
);

export function isValidator(value: unknown): value is Validator {
  return (
    // Later on, once support is better, this can be replaced with Object.hasOwn()
    Object.prototype.hasOwnProperty.call(value, packagePrivate) &&
    Object(value)[packagePrivate]?.type === 'validator'
  );
}

export function isExpectation(value: unknown): value is Expectation {
  return (
    // Later on, once support is better, this can be replaced with Object.hasOwn()
    Object.prototype.hasOwnProperty.call(value, packagePrivate) &&
    Object(value)[packagePrivate]?.type === 'expectation'
  );
}

export function isLazyEvaluator(value: unknown): value is LazyEvaluator {
  return (
    // Later on, once support is better, this can be replaced with Object.hasOwn()
    Object.prototype.hasOwnProperty.call(value, packagePrivate) &&
    Object(value)[packagePrivate]?.type === 'lazyEvaluator'
  );
}

export function createInterpolatedValueCheck(validator: ValidatorTemplateTag): Validator {
  const expectDirectInstance = expectDirectInstanceFactory(validator);
  return validator`
    ${validator.expectTo(value => validator`object`.matches(value) ? 'be a primitive.' : undefined)}
    | ${validator.expectTo(value => isValidator(value) ? undefined : 'be a Validator.')}
    | ${validator.expectTo(value => isExpectation(value) ? undefined : 'be an Expectation (from .expectTo()).')}
    | ${validator.expectTo(value => isLazyEvaluator(value) ? undefined : 'be a LazyEvaluator (from .lazy()).')}
    | ${expectDirectInstance(RegExp)}
    | ${Function}
  `;
}
