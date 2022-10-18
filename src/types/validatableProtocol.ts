// Everything in here is publicly exported

import type { validatable } from '../validatableProtocol';

export interface ValidatableProtocolFnOpts {
  readonly failure: (...args: ConstructorParameters<typeof Error>) => Error
  readonly at: string
}

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
