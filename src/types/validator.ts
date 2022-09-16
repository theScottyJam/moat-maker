import { Rule } from './parseRules';

export interface Validator {
  readonly matches: (value: unknown) => boolean
  readonly assertMatches: <T>(value: T) => T
  readonly rule: Rule
}
