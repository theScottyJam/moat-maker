// Tools related to assigning deepness values to failures,
// so we can keep around the "deepest" errors, while ignoring the less-useful, more shallow errors.
// e.g. If you're matching against `{ sub: { x: 2 } } | null`, and you pass in `{ sub: { x: 3 } }`, the
// only error that we need to show the user, is that the `x` property should have been `2`, not `5`. We
// don't need to explain the alternative option of dropping the whole object and replacing it with `null`.

import { availableDeepLevels as availableDeepLevelsForSimple } from './simpleEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForPrimitiveLiteral } from './privitiveLiteralEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForObject } from './propertyEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForArray } from './arrayEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForTuple } from './tupleEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForIterable } from './iterableEnforcer.js';
import { availableDeepLevels as availableDeepLevelsForInterpolation } from './interpolationEnforcer.js';
import { UnreachableCaseError } from '../util.js';
import type { Rule } from '../types/validationRules';

export interface DeepRange {
  readonly start: number
  readonly end: number
}

/**
 * When an error occurs, it can be assigned a "deepness level", to describe how deep of an issue the error is.
 * This is to help remove irrelevant information from union errors. When combining together various union variant failures
 * into a single error message, only those with the highest deepness level are considered.
 *
 * This, for example, makes it so if you have the pattern `{ x: 2 } | 3`, and a `{ x: 4 }` object got passed in,
 * only the error about how "<receivedValue>.x should be 3" will be shown, the error about how the whole value should
 * be the number three will be omitted.
 *
 * It's important to prune errors like these down, because in recursive union definitions, the number of failed
 * variants can quickly grow to astronomical numbers.
 */
export const DEEP_LEVELS = {
  // Used as a minimum value for algorithms. Shouldn't actually get passed around.
  min: { start: -1, end: -1 },
  // This is specifically used for the "is this value an instance of an Object" type check.
  // This category is separate from the normal "typeCheck" category, because you can run into scenarios where a value
  // is an object, but more specifically, it's an array, so you don't really care about the object checks if there were
  // array checks happening in the union as well.
  nonSpecificTypeCheck: { start: 0, end: 0 },
  // Any sort of general type-checking
  typeCheck: { start: 1, end: 1 },
  // Checks about information about the value that is readily available
  // (i.e. you don't have to recurse into a nested data structure to verify the info)
  immediateInfoCheck: { start: 2, end: 2 },
  // A general non-recursive check - used when the match could pertain to any specific type
  // of non-recursive check above, but you don't have enough information to categorize it.
  nonRecursiveCheck: { start: 0, end: 2 },
  // Used when a match should be prioritized in such a way that it always shows up.
  // However, you don't want it to influence what gets pruned.
  any: { start: 0, end: 3 },
  // Information that requires you to recurse into a nested data structure.
  recurseInwardsCheck: { start: 3, end: 3 },
} satisfies Record<string, DeepRange>;

export function getMaxDeepnessLevelOf(rule: Rule): DeepRange {
  if (rule.category === 'simple') {
    return maxDeepRange(Object.values(availableDeepLevelsForSimple()));
  } else if (rule.category === 'primitiveLiteral') {
    return maxDeepRange(Object.values(availableDeepLevelsForPrimitiveLiteral()));
  } else if (rule.category === 'noop') {
    return DEEP_LEVELS.min;
  } else if (rule.category === 'property') {
    return maxDeepRange(Object.values(availableDeepLevelsForObject()));
  } else if (rule.category === 'array') {
    return maxDeepRange(Object.values(availableDeepLevelsForArray()));
  } else if (rule.category === 'tuple') {
    return maxDeepRange(Object.values(availableDeepLevelsForTuple()));
  } else if (rule.category === 'iterable') {
    return maxDeepRange(Object.values(availableDeepLevelsForIterable()));
  } else if (rule.category === 'union') {
    // TODO: I should do better handling of the union type
    return DEEP_LEVELS.recurseInwardsCheck;
  } else if (rule.category === 'intersection') {
    // TODO: Make sure there are tests that cover this behavior
    return maxDeepRange(rule.variants.map(variant => getMaxDeepnessLevelOf(variant)));
  } else if (rule.category === 'interpolation') {
    return maxDeepRange(Object.values(availableDeepLevelsForInterpolation()));
  } else {
    throw new UnreachableCaseError(rule);
  }
}

export function maxDeepRange(ranges: readonly DeepRange[]): DeepRange {
  return {
    start: Math.max(...ranges.map(r => r.start)),
    end: Math.max(...ranges.map(r => r.end)),
  };
}
