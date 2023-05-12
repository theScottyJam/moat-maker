import type { Ruleset } from './validationRules';
import { packagePrivate } from '../packagePrivateAccess';

// This is currently only used internally.
// Perhaps some time in the future this feature will be publicly exported.
// For now, to avoid risking publishing a feature that isn't properly polished up
// it'll be kept as an internal detail.

/**
 * The deriveValidator() callback will be called when with a value
 * being validated. The callback is expected to return a validator instance,
 * which will then be used to validate the value. The callback will only be called
 * at the point when validation is happening at that rule - this allows you to perform
 * other assertions first, to make sure the data conforms to a certain shape, before
 * the callback is ran.
 *
 * The point is to allow you to use data from the object you're validating against, to
 * control the behavior of the validator.
 */
export interface LazyEvaluator {
  readonly [packagePrivate]: {
    readonly type: 'lazyEvaluator'
    readonly deriveValidator: (value: unknown) => Validator
  }
}

export interface ValidatorRef {
  readonly [packagePrivate]: {
    readonly type: 'ref'
    readonly getValidator: () => Validator
  }
  readonly set: (validator: Validator) => void
}

export interface AssertMatchesOpts {
  readonly errorFactory?: undefined | ((...params: ConstructorParameters<typeof Error>) => Error)
  readonly at?: undefined | string
  readonly errorPrefix?: undefined | string
}

export const createAssertMatchesOptsCheck = (validator: ValidatorTemplateTag): Validator => validator`{
  errorFactory?: undefined | ${Function}
  at?: undefined | string
  errorPrefix?: undefined | string
}`;

export interface Expectation {
  readonly [packagePrivate]: {
    readonly type: 'expectation'
    readonly testExpectation: (valueBeingMatched: unknown) => string | null
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
  createRef: () => ValidatorRef
  expectTo: (callback: (valueBeingMatched: unknown) => string | null) => Expectation
}

type Primitive = string | number | bigint | boolean | symbol | null | undefined;
export type InterpolatedValue = (
  Primitive
  | Validator
  | ValidatorRef
  | Expectation
  | RegExp
  | (new (...args: any) => any)
  | LazyEvaluator // Only used internally
);

export type ValidatorTemplateTag = ValidatorTemplateTagStaticFields & (
  <T>(
    parts: TemplateStringsArray,
    ...interpolated: readonly InterpolatedValue[]
  ) => Validator<T>
);

export function isValidator(value: unknown): value is Validator {
  return Object(value)[packagePrivate]?.type === 'validator';
}

export function isRef(value: unknown): value is ValidatorRef {
  return Object(value)[packagePrivate]?.type === 'ref';
}

export function isExpectation(value: unknown): value is Expectation {
  return Object(value)[packagePrivate]?.type === 'expectation';
}

export function isLazyEvaluator(value: unknown): value is LazyEvaluator {
  return Object(value)[packagePrivate]?.type === 'lazyEvaluator';
}

export function createInterpolatedValueCheck(validator: ValidatorTemplateTag): Validator {
  const primitiveCheck = validator`string | number | bigint | boolean | symbol | null | undefined`;
  return validator`
    ${validator.expectTo(value => primitiveCheck.matches(value) ? null : 'be a primitive.')}
    | ${validator.expectTo(value => isValidator(value) ? null : 'be a Validator.')}
    | ${validator.expectTo(value => isRef(value) ? null : 'be a ValidatorRef.')}
    | ${validator.expectTo(value => isExpectation(value) ? null : 'be an Expectation.')}
    | ${validator.expectTo(value => value instanceof RegExp ? null : 'be an instance of RegExp')}
    | ${validator.expectTo(value => value instanceof Function ? null : 'be an instance of Function')}
    | ${validator.expectTo(value => isLazyEvaluator(value) ? null : 'be an internally-used-only lazy evaluator.')}
  `;
}
