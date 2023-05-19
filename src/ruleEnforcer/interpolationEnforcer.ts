import type { InterpolationRule } from '../types/validationRules';
import { isExpectation, isLazyEvaluator, isValidator, type InterpolatedValue } from '../types/validator';
import { DEEP_LEVELS } from './deepnessTools';
import { isBrandOf, isDirectInstanceOf, reprUnknownValue, UnreachableCaseError } from '../util';
import { packagePrivate } from '../packagePrivateAccess';
import { match, type CheckFnResponse } from './ruleMatcherTools';
import type { LookupPath } from './LookupPath';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  nonRecursiveCheck: DEEP_LEVELS.nonRecursiveCheck,
  any: DEEP_LEVELS.any,
});

export function interpolationCheck(
  rule: InterpolationRule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): CheckFnResponse {
  const interpolatedValue = interpolated[rule.interpolationIndex];

  if (isValidator(interpolatedValue)) {
    const validatorMatchResponse = match(
      interpolatedValue.ruleset.rootRule,
      target,
      interpolatedValue.ruleset.interpolated,
      lookupPath,
    );

    if (validatorMatchResponse.failed()) {
      return [{
        matchResponse: validatorMatchResponse,
        deep: 'INHERIT' as const,
      }];
    }
  } else if (isLazyEvaluator(interpolatedValue)) {
    const validator = interpolatedValue[packagePrivate].deriveValidator(target);
    const validatorMatchResponse = match(
      validator.ruleset.rootRule,
      target,
      validator.ruleset.interpolated,
      lookupPath,
    );

    if (validatorMatchResponse.failed()) {
      return [{
        matchResponse: validatorMatchResponse,
        deep: 'INHERIT' as const,
      }];
    }
  } else if (isExpectation(interpolatedValue)) {
    const maybeErrorMessage = interpolatedValue[packagePrivate].testExpectation(target);
    if (maybeErrorMessage !== null) {
      return [{
        message: `Expected ${lookupPath.asString()}, which was ${reprUnknownValue(target)}, to ${maybeErrorMessage}`,
        lookupPath,
        deep: availableDeepLevels().any,
      }];
    }
  } else if (typeof interpolatedValue === 'function') {
    if (!isInstanceOf(target, interpolatedValue)) {
      return [{
        message: (
          `Expected ${lookupPath.asString()}, which was ${reprUnknownValue(target)}, ` +
          `to be an instance of ${reprUnknownValue(interpolatedValue)}.`
        ),
        lookupPath,
        deep: availableDeepLevels().nonRecursiveCheck,
      }];
    }
  } else if (isDirectInstanceOf(interpolatedValue, RegExp)) {
    if (typeof target !== 'string') {
      return [{
        message: (
          `Expected ${lookupPath.asString()}, which was ${reprUnknownValue(target)}, ` +
          `to be a string that matches the regular expression ${interpolatedValue.toString()}`
        ),
        lookupPath,
        deep: availableDeepLevels().nonRecursiveCheck,
      }];
    }
    if (target.match(interpolatedValue) === null) {
      return [{
        message: (
          `Expected ${lookupPath.asString()}, which was ${reprUnknownValue(target)}, ` +
          `to match the regular expression ${interpolatedValue.toString()}`
        ),
        lookupPath,
        deep: availableDeepLevels().nonRecursiveCheck,
      }];
    }
  } else if (!isObject(interpolatedValue)) {
    if (!sameValueZero(target, interpolatedValue)) {
      return [{
        message: (
          `Expected ${lookupPath.asString()} to be the value ${reprUnknownValue(interpolatedValue)} ` +
          `but got ${reprUnknownValue(target)}.`
        ),
        lookupPath,
        deep: availableDeepLevels().nonRecursiveCheck,
      }];
    }
  } else {
    throw new UnreachableCaseError(interpolatedValue);
  }

  return [];
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isObject = (value: unknown): value is object => Object(value) === value;

/**
 * Checks if `value` is an instance of `parentClass`, or an instance of a subclass of `parentClass`.
 * Symbol.hasInstance is ignored.
 * Brand checking is performed if the class is a built-in class.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function isInstanceOf(value: unknown, parentClass: Function): boolean {
  const targetPrototype: object | null = parentClass.prototype;
  // The `prototype` property is set to `null` on arrow functions.
  if (targetPrototype === null) {
    return false;
  }

  let currentPrototypeLink = Object.getPrototypeOf(value);
  while (true) {
    if (currentPrototypeLink === null) {
      break;
    }
    if (currentPrototypeLink === targetPrototype || isBrandOf(currentPrototypeLink, parentClass)) {
      return true;
    }
    currentPrototypeLink = Object.getPrototypeOf(currentPrototypeLink);
  }
  return false;
}

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);
