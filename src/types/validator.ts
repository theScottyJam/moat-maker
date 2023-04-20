import type { Ruleset } from './parsingRules';
import type { packagePrivate } from '../packagePrivateAccess';

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

export type ValidatorTemplateTag = ValidatorTemplateTagStaticFields & (
  <T>(
    parts: TemplateStringsArray,
    ...interpolated: readonly unknown[]
  ) => Validator<T>
);
