import { Rule, Ruleset } from './parsingRules';
import { ValidatableProtocol, ValidatableProtocolFn } from './validatableProtocol';
import type { validatable } from '../validatableProtocol';

export const isValidatorInstance = Symbol('isValidatorInstance');

export interface ValidatorRef extends ValidatableProtocol {
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

export interface CustomChecker extends ValidatableProtocol {
  protocolFn: ValidatableProtocolFn
}

export interface Validator<T=unknown> extends ValidatableProtocol {
  readonly [isValidatorInstance]: true
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
  checker: (callback: (valueBeingMatched: unknown) => boolean, opts?: { to?: string }) => CustomChecker
  validatable: typeof validatable
}

export type ValidatorTemplateTag = ValidatorTemplateTagStaticFields & (
  <T>(
    parts: TemplateStringsArray,
    ...interpolated: readonly unknown[]
  ) => Validator<T>
);
