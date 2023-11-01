// This module's API is the same as the publicly exported validator API.
// The main difference is that it does not verify that its exported functions are receiving valid arguments at runtime.
// This is done because the real validator API is just a thin wrapper over this module, which uses this module,
// both for its implementation and to validate the user-provided data.

import { parse } from './ruleParser/index.js';
import { freezeRuleset } from './ruleFreezer.js';
import { matchArgument, matchValue } from './ruleEnforcer/index.js';
import { lookupCacheEntry } from './cacheControl.js';
import type { Ruleset } from './types/validationRules.js';
import {
  type AssertMatchesOpts,
  type Validator,
  type LazyEvaluator,
  type ValidatorTemplateTag,
  type ValidatorTemplateTagStaticFields,
  type Expectation,
  type InterpolatedValue,
  isValidator,
  isExpectation,
  isLazyEvaluator,
} from './types/validator.js';
import { packagePrivate } from './packagePrivateAccess.js';

export const uncheckedValidator = function uncheckedValidator<T=unknown>(
  parts: TemplateStringsArray,
  ...interpolated: readonly InterpolatedValue[]
): Validator<T> {
  const cacheEntry = lookupCacheEntry(parts.raw);
  if (cacheEntry.exists()) {
    return fromRuleset<T>(freezeRuleset({
      rootRule: cacheEntry.get(),
      interpolated,
    }, { assumeRootRuleIsDeepFrozen: true }));
  } else {
    const ruleset = freezeRuleset({
      rootRule: parse(parts.raw, interpolated),
      interpolated,
    });
    cacheEntry.set(ruleset.rootRule);
    return fromRuleset<T>(ruleset);
  }
} as ValidatorTemplateTag;

// ruleset should already be frozen before this is called.
function fromRuleset<T=unknown>(ruleset: Ruleset): Validator<T> {
  return Object.freeze({
    [packagePrivate]: { type: 'validator' as const },
    assertMatches(value: unknown, opts?: AssertMatchesOpts): T {
      const matched = matchValue(
        ruleset.rootRule,
        value,
        ruleset.interpolated,
        opts?.at,
        { errorPrefix: opts?.errorPrefix },
      );

      // throw as TypeError relatively low down the call stack, so we don't have too
      // many unnecessary stack frames in the call stack.
      if (!matched.success) {
        if (opts?.errorFactory !== undefined) {
          throw opts?.errorFactory(matched.message);
        } else {
          throw new TypeError(matched.message);
        }
      }

      return value as T;
    },
    // Same as assertMatches(), except with a different type signature, and
    // returns void. Functions with assertion signatures have stricter rules
    // about when and how they can be used, and they can't be programmed to
    // return a value, which is why this is placed in a separate function.
    // If you're not using TypeScript, its recommended to simply ignore this.
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      const matched = matchValue(
        ruleset.rootRule,
        value,
        ruleset.interpolated,
        opts?.at,
        { errorPrefix: opts?.errorPrefix },
      );

      // Throw as TypeError relatively low down the call stack, so we don't have too
      // many unnecessary stack frames in the call stack.
      if (!matched.success) {
        if (opts?.errorFactory !== undefined) {
          throw opts?.errorFactory(matched.message);
        } else {
          throw new TypeError(matched.message);
        }
      }
    },
    assertArgs(whichFn: string, args: ArrayLike<unknown>) {
      const matched = matchArgument(
        ruleset.rootRule,
        Array.from(args),
        ruleset.interpolated,
        { whichFn },
      );

      // Throw as TypeError relatively low down the call stack, so we don't have too
      // many unnecessary stack frames in the call stack.
      if (!matched.success) {
        throw new TypeError(matched.message);
      }
    },
    matches(value: unknown): value is T {
      return matchValue(ruleset.rootRule, value, ruleset.interpolated).success;
    },
    ruleset,
  });
}

const staticFields: ValidatorTemplateTagStaticFields = {
  fromRuleset<T=unknown>(ruleset_: Ruleset): Validator<T> {
    return fromRuleset<T>(freezeRuleset(ruleset_));
  },

  from(unknownValue: string | Validator): Validator {
    return typeof unknownValue === 'string'
      ? fromRuleset(freezeRuleset({
        rootRule: parse([unknownValue], []),
        interpolated: [],
      }))
      : unknownValue;
  },

  lazy(deriveValidator: (value: unknown) => Validator): LazyEvaluator {
    return Object.freeze({
      [packagePrivate]: {
        type: 'lazyEvaluator' as const,
        deriveValidator,
      },
    });
  },

  expectTo(testExpectation: (valueBeingMatched: unknown) => string | undefined): Expectation {
    return {
      [packagePrivate]: { type: 'expectation', testExpectation },
    };
  },

  isValidator(value: unknown): value is Validator {
    return isValidator(value);
  },

  isExpectation(value: unknown): value is Expectation {
    return isExpectation(value);
  },

  isLazyEvaluator(value: unknown): value is LazyEvaluator {
    return isLazyEvaluator(value);
  },
};

Object.assign(uncheckedValidator, staticFields);
