import type { Validator, Expectation, ValidatorRef, InterpolatedValue } from './types/validator';
import type { FrozenMap as FrozenMapClass } from './util';
import { ValidatorSyntaxError } from './ruleParser';
import { validator } from './validatorApi';

export { ValidatorSyntaxError };
export * from './types/validationRules';
export type { Validator, Expectation, ValidatorRef, InterpolatedValue };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;
export { validator };
