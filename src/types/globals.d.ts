import type { validatable } from '../validatableProtocol';
import type { ValidatableProtocolFn } from './validatableProtocol';

declare global {
  interface Function {
    [validatable]: ValidatableProtocolFn
  }
}
