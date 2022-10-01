import { Rule } from './parseRules';

export const isValidatorInstance = Symbol('isValidatorInstance');

export interface Validator {
  readonly [isValidatorInstance]: true
  readonly matches: (value: unknown) => boolean
  readonly assertMatches: <T>(value: T) => T
  readonly rule: Rule
  readonly interpolated: readonly unknown[]
}
