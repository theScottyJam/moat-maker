import type { matcher } from '../matcherProtocol';

declare global {
  interface Function {
    [matcher]: (value: unknown) => { matched: boolean, value: unknown }
  }
}
