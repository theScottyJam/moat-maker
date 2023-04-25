import type { InterpolationRule, Rule } from '../types/validationRules';
import type { VariantMatchResponse } from './VariantMatchResponse';
import { type UnionVariantCollection } from './UnionVariantCollection';
import { isExpectation, isRef, isValidator, type SpecificRuleset } from './shared';
import { DEEP_LEVELS } from './deepnessTools';
import { ValidatorAssertionError } from '../exceptions';
import { assert, reprUnknownValue } from '../util';
import { packagePrivate } from '../packagePrivateAccess';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  nonRecursiveCheck: DEEP_LEVELS.nonRecursiveCheck,
});

export function preprocessInterpolatedValue(
  ruleset: SpecificRuleset<InterpolationRule>,
): { ruleset: SpecificRuleset<Rule>, updated: boolean } {
  const { rootRule, interpolated } = ruleset;
  const interpolatedValue = interpolated[rootRule.interpolationIndex];

  if (isValidator(interpolatedValue)) {
    return {
      ruleset: interpolatedValue.ruleset,
      updated: true,
    };
  } else if (isRef(interpolatedValue)) {
    return {
      ruleset: interpolatedValue[packagePrivate].getValidator().ruleset,
      updated: true,
    };
  } else {
    return { ruleset, updated: false };
  }
}

export function matchInterpolationVariants(
  variantCollection: UnionVariantCollection<InterpolationRule>,
  target: unknown,
  lookupPath: string,
): VariantMatchResponse<InterpolationRule> {
  assert(!variantCollection.isEmpty());
  return variantCollection.matchEach(({ rootRule, interpolated: allInterpolated }) => {
    const interpolatedTarget = allInterpolated[rootRule.interpolationIndex];
    assert(!isValidator(interpolatedTarget));
    assert(!isRef(interpolatedTarget));

    if (isExpectation(interpolatedTarget)) {
      const maybeErrorMessage = interpolatedTarget[packagePrivate].testExpectation(target);
      if (maybeErrorMessage !== null) {
        throw new ValidatorAssertionError(
          `Expected ${lookupPath}, which was ${reprUnknownValue(target)}, to ${maybeErrorMessage}`,
        );
      }
    } else if (typeof interpolatedTarget === 'function') {
      if (Object(target).constructor !== interpolatedTarget || !(Object(target) instanceof interpolatedTarget)) {
        throw new ValidatorAssertionError(
          `Expected ${lookupPath}, which was ${reprUnknownValue(target)}, to be an instance of ${reprUnknownValue(interpolatedTarget)} ` +
          '(and not an instance of a subclass).',
        );
      }
    } else if (interpolatedTarget instanceof RegExp) {
      if (typeof target !== 'string') {
        throw new ValidatorAssertionError(
          `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to be a string that matches the regular expression ${interpolatedTarget.toString()}`,
        );
      }
      if (target.match(interpolatedTarget) === null) {
        throw new ValidatorAssertionError(
          `Expected <receivedValue>, which was ${reprUnknownValue(target)}, to match the regular expression ${interpolatedTarget.toString()}`,
        );
      }
    } else if (isObject(interpolatedTarget)) {
      // TODO: It would be nice if we could do this check earlier, when the validator instance is first made
      // (There's already tests for this, so those tests can be updated as well).
      throw new TypeError(
        'Not allowed to interpolate a regular object into a validator. ' +
        '(Exceptions include classes, validators, refs, etc)',
      );
    } else if (!sameValueZero(target, interpolatedTarget)) {
      throw new ValidatorAssertionError(
        `Expected ${lookupPath} to be the value ${reprUnknownValue(interpolatedTarget)} but got ${reprUnknownValue(target)}.`,
      );
    }
  }, { deep: availableDeepLevels().nonRecursiveCheck });
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

const isObject = (value: unknown): value is object => Object(value) === value;

/** Compares two values using JavaScript's SameValueZero algorithm. */
const sameValueZero = (x: unknown, y: unknown): boolean => (
  x === y || (Number.isNaN(x) && Number.isNaN(y))
);
