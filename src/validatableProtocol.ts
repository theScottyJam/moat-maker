import { ValidatableProtocol } from './types/validatableProtocol';

export const validatable = Symbol('validatable');

export function conformsToValidatableProtocol(value: unknown): value is ValidatableProtocol {
  return validatable in Object(value);
}
