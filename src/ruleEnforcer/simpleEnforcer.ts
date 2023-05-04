import type { SimpleRule } from '../types/validationRules';
import { getSimpleTypeOf } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import type { CheckFnResponse } from './ruleMatcherTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
});

export function simpleCheck(
  rule: SimpleRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): CheckFnResponse {
  if (getSimpleTypeOf(target) === rule.type) {
    return [];
  }

  let whatWasGot = `type "${getSimpleTypeOf(target)}"`;
  if (Array.isArray(target)) {
    whatWasGot = 'an array';
  } else if (target instanceof Function) {
    whatWasGot = 'a function';
  }

  return [{
    message: `Expected ${lookupPath} to be of type "${rule.type}" but got ${whatWasGot}.`,
    deep: availableDeepLevels().typeCheck,
  }];
}
