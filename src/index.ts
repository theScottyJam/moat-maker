import { Validator } from './types/validator';
import { FrozenMap as FrozenMapClass } from './util';
import { ValidatorSyntaxError } from './exceptions';
import { validator } from './validatorApi';

export { ValidatorSyntaxError };
export * from './types/parsingRules';
export * from './types/validatableProtocol';
export type { Validator };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;
export { validator };
