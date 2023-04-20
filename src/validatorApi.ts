import { type Ruleset, _parsingRulesInternals } from './types/parsingRules';
import {
  type AssertMatchesOpts,
  createAssertMatchesOptsCheck,
  type Validator,
  type ValidatorRef,
  type ValidatorTemplateTagStaticFields,
  type ValidatorTemplateTag,
  type Expectation,
} from './types/validator';
import { uncheckedValidator } from './uncheckedValidatorApi';
import { packagePrivate } from './packagePrivateAccess';
import { DISABLE_PARAM_VALIDATION } from './config';

const { createRulesetCheck } = _parsingRulesInternals[packagePrivate];
const rulesetCheck = createRulesetCheck(uncheckedValidator);

const expectValidator = uncheckedValidator.expectTo(
  (value: unknown) => Object(value)[packagePrivate]?.type === 'validator'
    ? null
    : 'be a validator instance.',
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
  ...interpolated: readonly unknown[]
): Validator<T> {
  !DISABLE_PARAM_VALIDATION && uncheckedValidator`[parts: { raw: string[] }, ...interpolated: unknown[]]`
    .assertArgs(validator.name, arguments);

  return wrapValidatorWithUserInputChecks(uncheckedValidator(parts, ...interpolated));
} as ValidatorTemplateTag;

function wrapValidatorWithUserInputChecks<T>(unwrappedValidator: Validator<T>): Validator<T> {
  return Object.freeze({
    [packagePrivate]: { type: 'validator' as const },
    assertMatches(value: unknown, opts?: AssertMatchesOpts): T {
      // TODO: I'm not validating the return value of opts.errorFactory
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs('<validator instance>.assertMatches', arguments);

      return unwrappedValidator.assertMatches(value, opts);
    },
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      // TODO: I'm not validating the return value of opts.errorFactory
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown, opts?: ${createAssertMatchesOptsCheck(uncheckedValidator)}]`
        .assertArgs('<validator instance>.assertionTypeGuard', arguments);

      unwrappedValidator.assertionTypeGuard(value, opts);
    },
    assertArgs(whichFn: string, args: ArrayLike<unknown>) {
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[whichFn: string, args: ${expectArrayLike}]`
        .assertArgs('<validator instance>.assertArgs', arguments);

      unwrappedValidator.assertArgs(whichFn, args);
    },
    matches(value: unknown): value is T {
      !DISABLE_PARAM_VALIDATION && uncheckedValidator`[value: unknown]`.assertArgs('<validator instance>.matches', arguments);
      return unwrappedValidator.matches(value);
    },
    ruleset: unwrappedValidator.ruleset,
  });
}

const staticFields: ValidatorTemplateTagStaticFields = {
  fromRuleset<T=unknown>(ruleset: Ruleset): Validator<T> {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[ruleset: ${rulesetCheck}]`
      .assertArgs('validator.fromRuleset', arguments);

    return wrapValidatorWithUserInputChecks(uncheckedValidator.fromRuleset<T>(ruleset));
  },

  from(unknownValue: string | Validator): Validator {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[stringOrValidator: string | ${expectValidator}]`
      .assertArgs('validator.from', arguments);

    return typeof unknownValue === 'string'
      ? wrapValidatorWithUserInputChecks(uncheckedValidator.from(unknownValue))
      : unknownValue;
  },

  createRef(): ValidatorRef {
    uncheckedValidator`[]`.assertArgs('validator.createRef', arguments);
    const ref = uncheckedValidator.createRef();
    return Object.freeze({
      [packagePrivate]: ref[packagePrivate],
      set(validator_: Validator) {
        !DISABLE_PARAM_VALIDATION && uncheckedValidator`[validator: ${expectValidator}]`
          .assertArgs('<validator ref>.set', arguments);

        ref.set(validator_);
      },
    });
  },

  expectTo(testExpectation_: (valueBeingMatched: unknown) => string | null): Expectation {
    !DISABLE_PARAM_VALIDATION && uncheckedValidator`[testExpectation: ${Function}]`
      .assertArgs('validator.expectTo', arguments);

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
