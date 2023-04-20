import type { InterpolationRule } from '../types/parsingRules';
import type { VariantMatchResponse } from './VariantMatchResponse';
import { UnionVariantCollection } from './UnionVariantCollection';
import { DEEP_LEVELS } from './shared';
import { createValidatorAssertionError } from '../exceptions';
import { reprUnknownValue } from '../util';
import type { ValidatorRef, Validator, Expectation } from '../types/validator';
import { matchVariants } from './unionEnforcer';
import { packagePrivate } from '../packagePrivateAccess';

export function matchInterpolationVariants<T>(
  variants: UnionVariantCollection<InterpolationRule>,
  target: T,
  interpolated: readonly unknown[],
  lookupPath: string,
): VariantMatchResponse<InterpolationRule> {
  return variants.matchEach(variant => {
    const valueToMatch = interpolated[variant.interpolationIndex];

    if (isValidator(valueToMatch)) {
      matchVariants(
        new UnionVariantCollection([valueToMatch.ruleset.rootRule]),
        target,
        valueToMatch.ruleset.interpolated,
        lookupPath,
        { deep: DEEP_LEVELS.irrelevant },
      ).throwIfFailed();
    } else if (isRef(valueToMatch)) {
      const validator = valueToMatch[packagePrivate].getValidator();
      matchVariants(
        new UnionVariantCollection([validator.ruleset.rootRule]),
        target,
        validator.ruleset.interpolated,
        lookupPath,
        { deep: DEEP_LEVELS.irrelevant },
      ).throwIfFailed();
    } else if (isExpectation(valueToMatch)) {
      const maybeErrorMessage = valueToMatch[packagePrivate].testExpectation(target);
      if (maybeErrorMessage !== null) {
        throw createValidatorAssertionError(
          `Expected ${lookupPath}, which was ${reprUnknownValue(target)}, to ${maybeErrorMessage}`,
        );
      }
    } else if (typeof valueToMatch === 'function') {
      if (Object(target).constructor !== valueToMatch || !(Object(target) instanceof valueToMatch)) {
        throw createValidatorAssertionError(
          `Expected ${lookupPath}, which was ${reprUnknownValue(target)}, to be an instance of ${reprUnknownValue(valueToMatch)} ` +
          '(and not an instance of a subclass).',
        );
      }
    } else if (valueToMatch instanceof RegExp) {
      if (typeof target !== 'string') {
        throw createValidatorAssertionError(
          `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to be a string that matches the regular expression ${valueToMatch.toString()}`,
        );
      }
      if (target.match(valueToMatch) === null) {
        throw createValidatorAssertionError(
          `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to match the regular expression ${valueToMatch.toString()}`,
        );
      }
    } else if (isObject(valueToMatch)) {
      // TODO: It would be nice if we could do this check earlier, when the validator instance is first made
      // (There's already tests for this, so those tests can be updated as well).
      throw new TypeError(
        'Not allowed to interpolate a regular object into a validator. ' +
        '(Exceptions include classes, validators, refs, etc)',
      );
    } else if (!sameValueZero(target, valueToMatch)) {
      throw createValidatorAssertionError(
        `Expected ${lookupPath} to be the value ${reprUnknownValue(valueToMatch)} but got ${reprUnknownValue(target)}.`,
      );
    }
  }, { deep: DEEP_LEVELS.unorganized });
}

function isValidator(value: unknown): value is Validator {
  return Object(value)[packagePrivate]?.type === 'validator';
}

function isRef(value: unknown): value is ValidatorRef {
  return Object(value)[packagePrivate]?.type === 'ref';
}

function isExpectation(value: unknown): value is Expectation {
  return Object(value)[packagePrivate]?.type === 'expectation';
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isObject = (value: unknown): value is object => Object(value) === value;

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);
