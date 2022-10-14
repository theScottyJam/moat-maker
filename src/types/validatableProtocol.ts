// Everything in here is publicly exported

import type { validatable } from '../validatableProtocol';

/**
 * The shape of the function that should be
 * assigned to the validatable symbol.
 */
export type ValidatableProtocolFn = (value: unknown, lookupPath: string) => void;

/**
 * A value that implements the validatable-protocol would
 * implement this interface.
 */
export interface ValidatableProtocol {
  [validatable]: ValidatableProtocolFn
}
