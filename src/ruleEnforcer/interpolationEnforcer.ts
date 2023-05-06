import type { InterpolationRule } from '../types/validationRules';
import { isExpectation, isRef, isValidator } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { reprUnknownValue } from '../util';
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
  interpolated: readonly unknown[],
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
  } else if (isRef(interpolatedValue)) {
    const validator = interpolatedValue[packagePrivate].getValidator();
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
    if (Object(target).constructor !== interpolatedValue || !(Object(target) instanceof interpolatedValue)) {
      return [{
        message: (
          `Expected ${lookupPath.asString()}, which was ${reprUnknownValue(target)}, ` +
          `to be an instance of ${reprUnknownValue(interpolatedValue)} ` +
          '(and not an instance of a subclass).'
        ),
        lookupPath,
        deep: availableDeepLevels().nonRecursiveCheck,
      }];
    }
  } else if (interpolatedValue instanceof RegExp) {
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
  } else if (isObject(interpolatedValue)) {
    // TODO: It would be nice if we could do this check earlier, when the validator instance is first made
    // (There's already tests for this, so those tests can be updated as well).
    throw new TypeError(
      'Not allowed to interpolate a regular object into a validator. ' +
      '(Exceptions include classes, validators, refs, etc)',
    );
  } else if (!sameValueZero(target, interpolatedValue)) {
    return [{
      message: (
        `Expected ${lookupPath.asString()} to be the value ${reprUnknownValue(interpolatedValue)} ` +
        `but got ${reprUnknownValue(target)}.`
      ),
      lookupPath,
      deep: availableDeepLevels().nonRecursiveCheck,
    }];
  }

  return [];
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isObject = (value: unknown): value is object => Object(value) === value;

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);
