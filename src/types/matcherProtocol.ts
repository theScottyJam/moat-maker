// Everything in here is publicly exported

import type { matcher } from '../matcherProtocol';

/// The shape of the function that should be
/// assigned to the matcher symbol.
export type MatcherProtocolFn = (value: unknown, path: string) => void;

/// A value that implements the matcher-protocol would
/// implement this interface.
export interface MatcherProtocol {
  [matcher]: MatcherProtocolFn
}
