// Everything in here is publicly exported

import type { Validator, ValidatorTemplateTag } from './validator';
import type { validatable } from '../validatableProtocol';
import { packagePrivate } from './packagePrivateAccess';

export interface ValidatableProtocolFnOpts {
  readonly failure: (...args: ConstructorParameters<typeof Error>) => Error
  readonly at: string
}

const createValidatableProtocolFnOptsCheck = (validator: ValidatorTemplateTag): Validator => validator`{
  failure: ${Function}
  at: string
}`;

/**
 * The shape of the function that should be
 * assigned to the validatable symbol.
 */
export type ValidatableProtocolFn = (value: unknown, opts: ValidatableProtocolFnOpts) => void;

/**
 * A value that implements the validatable-protocol would
 * implement this interface.
 */
export interface ValidatableProtocol {
  [validatable]: ValidatableProtocolFn
}

export const _validatableProtocolInternals = {
  [packagePrivate]: { createValidatableProtocolFnOptsCheck },
};
