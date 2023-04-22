import type { Validator, Expectation, ValidatorRef } from './types/validator';
import type { FrozenMap as FrozenMapClass } from './util';
import { ValidatorAssertionError, ValidatorSyntaxError } from './exceptions';
import { validator } from './validatorApi';

export { ValidatorAssertionError, ValidatorSyntaxError };
export * from './types/validationRules';
export type { Validator, Expectation, ValidatorRef };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;
export { validator };
