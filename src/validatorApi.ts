import { type Ruleset, _validationRulesInternals } from './types/validationRules';
import {
  createAssertMatchesOptsCheck,
  createInterpolatedValueCheck,
  isValidator,
  wrapErrorFactoryFnWithAssertions,
  type AssertMatchesOpts,
  type Validator,
  type LazyEvaluator,
  type ValidatorTemplateTagStaticFields,
  type ValidatorTemplateTag,
  type Expectation,
  type InterpolatedValue,
} from './types/validator';
import { uncheckedValidator } from './uncheckedValidatorApi';
import { packagePrivate } from './packagePrivateAccess';
import { DISABLE_PARAM_VALIDATION } from './config';
import { expectDirectInstanceFactory } from './validationHelpers';

const { createRulesetCheck } = _validationRulesInternals[packagePrivate];
const rulesetCheck = createRulesetCheck(uncheckedValidator);
const interpolatedValueCheck = createInterpolatedValueCheck(uncheckedValidator);
const expectDirectInstance = expectDirectInstanceFactory(uncheckedValidator);

const expectValidator = uncheckedValidator.expectTo(
  (value: unknown) => isValidator(value) ? undefined : 'be a validator instance.',
);

const expectArrayLike = uncheckedValidator.expectTo(
  (value: unknown) => {
    const isArrayLike = (
      'length' in Object(value) &&
      typeof (value as any).length === 'number' &&
      (value as any).length >= 0 &&
      Math.floor((value as any).length) === (value as any).length
    );

    return isArrayLike ? undefined : 'be array-like.';
  },
);

/**
 * You can provide TypeScript-like syntax to this template tag. Returns a Validator instance which
 * contains various methods you can use to validate that data implements the expected type.
 */
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
    assertMatches(value: unknown, opts_?: AssertMatchesOpts): T {
      const fnName = '<validator instance>.assertMatches()';
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs(fnName, arguments);

      const opts = {
        ...opts_ ?? {},
        errorFactory: opts_?.errorFactory === undefined
          ? undefined
          : wrapErrorFactoryFnWithAssertions(opts_.errorFactory, fnName, validator),
      };

      return unwrappedValidator.assertMatches(value, opts);
    },
    assertionTypeGuard(value: unknown, opts_?: AssertMatchesOpts): asserts value is T {
      const fnName = '<validator instance>.assertionTypeGuard()';
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs(fnName, arguments);

      const opts = {
        ...opts_ ?? {},
        errorFactory: opts_?.errorFactory === undefined
          ? undefined
          : wrapErrorFactoryFnWithAssertions(opts_.errorFactory, fnName, validator),
      };

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

  expectTo(testExpectation_: (valueBeingMatched: unknown) => string | undefined): Expectation {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[testExpectation: ${expectDirectInstance(Function)}]`
      .assertArgs('validator.expectTo()', arguments);

    const testExpectation = (valueBeingMatched: unknown): string | undefined => {
      const result = testExpectation_(valueBeingMatched);
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`string | undefined`.assertMatches(result, {
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
