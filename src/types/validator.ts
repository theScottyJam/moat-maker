import { Rule } from './parsingRules';
import { ValidatableProtocol } from './validatableProtocol';

export const isValidatorInstance = Symbol('isValidatorInstance');

export interface ValidatorRef extends ValidatableProtocol {
  readonly set: (validator: Validator) => void
}

export interface AssertMatchesOpts {
  readonly errorFactory?: (...params: ConstructorParameters<typeof Error>) => Error
  readonly at?: string
}

export interface Validator<T=unknown> extends ValidatableProtocol {
  readonly [isValidatorInstance]: true
  readonly matches: (value: unknown) => value is T
  readonly assertMatches: (value: unknown, opts?: AssertMatchesOpts) => T
  readonly assertionTypeGuard: (value: unknown, opts?: AssertMatchesOpts) => asserts value is T
  readonly rule: Rule
  readonly interpolated: readonly unknown[]
}
