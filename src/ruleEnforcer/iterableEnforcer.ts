import { _parsingRulesInternals, type IterableRule } from '../types/validationRules';
import { DEEP_LEVELS } from './deepnessTools';
import { match, type CheckFnResponse } from './ruleMatcherTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function iterableCheck(
  rule: IterableRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): CheckFnResponse {
  if (!isIterable(target)) {
    return [{
      message: `Expected ${lookupPath} to be an iterable, i.e. you should be able to use this value in a for-of loop.`,
      deep: availableDeepLevels().typeCheck,
      progress: -2,
    }];
  }

  const iterableTypeMatchResponse = match(rule.iterableType, target, interpolated, lookupPath);

  if (iterableTypeMatchResponse.failed()) {
    return [{
      matchResponse: iterableTypeMatchResponse,
      deep: availableDeepLevels().immediateInfoCheck,
      progress: -1,
    }];
  }

  let i = 0;
  for (const entry of target) {
    const entryMatchResponse = match(rule.entryType, entry, interpolated, `[...${lookupPath}][${i}]`);

    if (entryMatchResponse.failed()) {
      return [{
        matchResponse: entryMatchResponse,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: i,
      }];
    }

    ++i;
  }

  return [];
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isIterable = (value: unknown): value is { [Symbol.iterator]: () => Iterator<unknown> } => (
  typeof Object(value)[Symbol.iterator] === 'function'
);
