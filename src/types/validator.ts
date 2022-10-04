import { Rule } from './parseRules';
import { ValidatableProtocol } from './validatableProtocol';

export const isValidatorInstance = Symbol('isValidatorInstance');

export interface ValidatorRef extends ValidatableProtocol {
  readonly set: (validator: Validator) => void
}

export interface Validator extends ValidatableProtocol {
  readonly [isValidatorInstance]: true
  readonly matches: (value: unknown) => boolean
  readonly assertMatches: <T>(value: T) => T
  readonly rule: Rule
  readonly interpolated: readonly unknown[]
}
