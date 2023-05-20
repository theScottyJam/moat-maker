import type { Ruleset } from './validationRules';
import { packagePrivate } from '../packagePrivateAccess';
import { expectDirectInstanceFactory } from '../validationHelpers';

export interface AssertMatchesOpts {
  readonly errorFactory?: undefined | ((...params: ConstructorParameters<typeof Error>) => Error)
  readonly at?: undefined | string
  readonly errorPrefix?: undefined | string
}

export function createAssertMatchesOptsCheck(validator: ValidatorTemplateTag): Validator {
  const expectDirectInstance = expectDirectInstanceFactory(validator);
  return validator`{
    errorFactory?: undefined | ${expectDirectInstance(Function)}
    at?: undefined | string
    errorPrefix?: undefined | string
  }`;
}

export interface Expectation {
  readonly [packagePrivate]: {
    readonly type: 'expectation'
    readonly testExpectation: (valueBeingMatched: unknown) => string | null
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
  expectTo: (callback: (valueBeingMatched: unknown) => string | null) => Expectation
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
    ${validator.expectTo(value => validator`object`.matches(value) ? 'be a primitive.' : null)}
    | ${validator.expectTo(value => isValidator(value) ? null : 'be a Validator.')}
    | ${validator.expectTo(value => isExpectation(value) ? null : 'be an Expectation (from .expectTo()).')}
    | ${validator.expectTo(value => isLazyEvaluator(value) ? null : 'be a LazyEvaluator (from .lazy()).')}
    | ${expectDirectInstance(RegExp)}
    | ${Function}
  `;
}
