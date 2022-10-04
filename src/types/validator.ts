import { Rule } from './parseRules';
import { ValidatableProtocol } from './validatableProtocol';

export const isValidatorInstance = Symbol('isValidatorInstance');

export interface ValidatorRef extends ValidatableProtocol {
  readonly set: (validator: Validator) => void
}

export interface Validator<T=unknown> extends ValidatableProtocol {
  readonly [isValidatorInstance]: true
  readonly matches: (value: unknown) => value is T
  readonly assertMatches: (value: unknown) => asserts value is T
  readonly getAsserted: (value: unknown) => T
  readonly rule: Rule
  readonly interpolated: readonly unknown[]
}
