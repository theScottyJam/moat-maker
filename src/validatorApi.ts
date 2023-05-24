import { type Ruleset, _validationRulesInternals } from './types/validationRules';
import {
  type AssertMatchesOpts,
  createAssertMatchesOptsCheck,
  type Validator,
  type LazyEvaluator,
  type ValidatorTemplateTagStaticFields,
  type ValidatorTemplateTag,
  type Expectation,
  type InterpolatedValue,
  createInterpolatedValueCheck,
  isValidator,
} from './types/validator';
import { uncheckedValidator } from './uncheckedValidatorApi';
import { packagePrivate } from './packagePrivateAccess';
import { DISABLE_PARAM_VALIDATION } from './config';
import { expectDirectInstanceFactory } from './validationHelpers';
import { isDirectInstanceOf } from './util';

const { createRulesetCheck } = _validationRulesInternals[packagePrivate];
const rulesetCheck = createRulesetCheck(uncheckedValidator);
const interpolatedValueCheck = createInterpolatedValueCheck(uncheckedValidator);
const expectDirectInstance = expectDirectInstanceFactory(uncheckedValidator);

const expectValidator = uncheckedValidator.expectTo(
  (value: unknown) => isValidator(value) ? null : 'be a validator instance.',
);

const expectArrayLike = uncheckedValidator.expectTo(
  (value: unknown) => {
    const isArrayLike = (
      'length' in Object(value) &&
      typeof (value as any).length === 'number' &&
      (value as any).length >= 0 &&
      Math.floor((value as any).length) === (value as any).length
    );

    return isArrayLike ? null : 'be array-like.';
  },
);

export const validator = function validator<T=unknown>(
  parts: TemplateStringsArray,
  ...interpolated: readonly InterpolatedValue[]
): Validator<T> {
  !DISABLE_PARAM_VALIDATION && uncheckedValidator`[
    parts: { raw: string[] } & ${expectDirectInstance(Array)},
    ...interpolated: ${interpolatedValueCheck}[]
  ]`
    .assertArgs('validator`...`', arguments);

  return wrapValidatorWithUserInputChecks(uncheckedValidator(parts, ...interpolated));
} as ValidatorTemplateTag;

function wrapValidatorWithUserInputChecks<T>(unwrappedValidator: Validator<T>): Validator<T> {
  return Object.freeze({
    [packagePrivate]: { type: 'validator' as const },
    assertMatches(value: unknown, opts?: AssertMatchesOpts): T {
      // TODO: I'm not validating the return value of opts.errorFactory
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs('<validator instance>.assertMatches()', arguments);

      return unwrappedValidator.assertMatches(value, opts);
    },
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      // TODO: I'm not validating the return value of opts.errorFactory
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs('<validator instance>.assertionTypeGuard()', arguments);

      unwrappedValidator.assertionTypeGuard(value, opts);
    },
    assertArgs(whichFn: string, args: ArrayLike<unknown>) {
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[whichFn: string, args: ${expectArrayLike}]`
        .assertArgs('<validator instance>.assertArgs()', arguments);

      unwrappedValidator.assertArgs(whichFn, args);
    },
    matches(value: unknown): value is T {
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown]`
        .assertArgs('<validator instance>.matches()', arguments);

      return unwrappedValidator.matches(value);
    },
    ruleset: unwrappedValidator.ruleset,
  });
}

const staticFields: ValidatorTemplateTagStaticFields = {
  fromRuleset<T=unknown>(ruleset: Ruleset): Validator<T> {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[ruleset: ${rulesetCheck}]`
      .assertArgs('validator.fromRuleset()', arguments);

    return wrapValidatorWithUserInputChecks(uncheckedValidator.fromRuleset<T>(ruleset));
  },

  from(unknownValue: string | Validator): Validator {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[stringOrValidator: string | ${expectValidator}]`
      .assertArgs('validator.from()', arguments);

    return typeof unknownValue === 'string'
      ? wrapValidatorWithUserInputChecks(uncheckedValidator.from(unknownValue))
      : unknownValue;
  },

  lazy(deriveValidator_: (value: unknown) => Validator): LazyEvaluator {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[deriveValidator: ${expectDirectInstance(Function)}]`
      .assertArgs('validator.lazy()', arguments);

    const deriveValidator = (valueBeingMatched: unknown): Validator => {
      const result = deriveValidator_(valueBeingMatched);
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`${expectValidator}`.assertMatches(result, {
        errorPrefix: 'validator.lazy() received a bad "deriveValidator" function:',
        at: '<deriveValidator return value>',
      });
      return result;
    };

    return uncheckedValidator.lazy(deriveValidator);
  },

  expectTo(testExpectation_: (valueBeingMatched: unknown) => string | null): Expectation {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[testExpectation: ${expectDirectInstance(Function)}]`
      .assertArgs('validator.expectTo()', arguments);

    const testExpectation = (valueBeingMatched: unknown): string | null => {
      const result = testExpectation_(valueBeingMatched);
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`string | null`.assertMatches(result, {
        errorPrefix: 'validator.expectTo() received a bad "testExpectation" function:',
        at: '<testExpectation return value>',
      });
      return result;
    };

    return Object.freeze({
      [packagePrivate]: {
        type: 'expectation' as const,
        testExpectation,
      },
    });
  },
};

Object.assign(validator, staticFields);
