import type { matcher } from '../matcherProtocol';
import type { MatcherProtocolFn } from './matcherProtocol';

declare global {
  interface Function {
    [matcher]: MatcherProtocolFn
  }
}
