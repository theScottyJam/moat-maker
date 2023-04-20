import type { Validator, Expectation } from './types/validator';
import type { FrozenMap as FrozenMapClass } from './util';
import { ValidatorAssertionError, ValidatorSyntaxError } from './exceptions';
import { validator } from './validatorApi';

export { ValidatorAssertionError, ValidatorSyntaxError };
export * from './types/parsingRules';
export type { Validator, Expectation };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;
export { validator };
