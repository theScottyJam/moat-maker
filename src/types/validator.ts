import type { Ruleset } from './validationRules';
import { packagePrivate } from '../packagePrivateAccess';
import { expectDirectInstanceFactory, expectKeysFromFactory } from '../validationHelpers';
import { DISABLE_PARAM_VALIDATION } from '../config';

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
  readonly matches: (value: unknown) => value is T
  readonly assertMatches: (value: unknown, opts?: AssertMatchesOpts) => T
  readonly assertionTypeGuard: (value: unknown, opts?: AssertMatchesOpts) => asserts value is T
  readonly assertArgs: (whichFn: string, args: ArrayLike<unknown>) => void
  readonly ruleset: Ruleset
}

export interface ValidatorTemplateTagStaticFields {
  fromRuleset: <T=unknown>(rule: Ruleset) => Validator<T>
  from: (unknownValue: string | Validator) => Validator
  lazy: (deriveValidator: (value: unknown) => Validator) => LazyEvaluator
  expectTo: (callback: (valueBeingMatched: unknown) => string | undefined) => Expectation
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
