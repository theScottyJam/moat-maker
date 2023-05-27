import type { Validator, Expectation, LazyEvaluator, InterpolatedValue } from './types/validator.js';
import type { FrozenMap as FrozenMapClass } from './util.js';
import { ValidatorSyntaxError } from './ruleParser/index.js';
import { validator } from './validatorApi.js';

export { ValidatorSyntaxError };
export * from './types/validationRules.js';
export type { Validator, Expectation, LazyEvaluator, InterpolatedValue };
export type FrozenMap<K, V> = InstanceType<typeof FrozenMapClass>;
export { validator };
