// This module's API is the same as the publicly exported validator API.
// The main difference is that it does not verify that its exported functions are receiving valid arguments at runtime.
// This is done because the real validator API is just a thin wrapper over this module, which uses this module,
// both for its implementation and to validate the user-provided data.

import { assert } from './util';
import { parse } from './ruleParser';
import { freezeRuleset } from './ruleFreezer';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { lookupCacheEntry } from './cacheControl';
import type { Rule, Ruleset } from './types/validationRules';
import type {
  AssertMatchesOpts,
  Validator,
  ValidatorRef,
  ValidatorTemplateTag,
  ValidatorTemplateTagStaticFields,
  Expectation,
} from './types/validator';
import { ValidatorAssertionError } from './exceptions';
import { packagePrivate } from './packagePrivateAccess';

export const uncheckedValidator = function uncheckedValidator<T=unknown>(
  parts: TemplateStringsArray,
  ...interpolated: readonly unknown[]
): Validator<T> {
  const cacheEntry = lookupCacheEntry(parts.raw);
  if (cacheEntry.exists()) {
    return fromRuleset<T>(freezeRuleset({
      rootRule: cacheEntry.get(),
      interpolated,
    }, { assumeRootRuleIsDeepFrozen: true }));
  } else {
    const ruleset = freezeRuleset({
      rootRule: parse(parts.raw),
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
      if (opts?.errorPrefix?.endsWith(':') === false) {
        throw new TypeError('The assertMatches() errorPrefix string must end with a colon.');
      }

      try {
        assertMatches(ruleset.rootRule, value, ruleset.interpolated, opts?.at);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          const prefix = opts?.errorPrefix !== undefined ? opts.errorPrefix + ' ' : '';
          if (opts?.errorFactory !== undefined) {
            throw opts?.errorFactory(...buildRethrowErrorArgs(error, prefix + error.message));
          } else {
            throw new TypeError(...buildRethrowErrorArgs(error, prefix + error.message));
          }
        }
        throw error;
      }

      return value as any;
    },
    // Same as assertMatches(), except with a different type signature, and
    // returns void. Functions with assertion signatures have stricter rules
    // about when and how they can be used, and they can't be programmed to
    // return a value, which is why this is placed in a separate function.
    // If you're not using TypeScript, its recommended to simply ignore this.
    assertionTypeGuard(value: unknown, opts?: AssertMatchesOpts): asserts value is T {
      if (opts?.errorPrefix?.endsWith(':') === false) {
        throw new TypeError('The assertionTypeGuard() errorPrefix string must end with a colon.');
      }

      try {
        assertMatches(ruleset.rootRule, value, ruleset.interpolated, opts?.at);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          const prefix = opts?.errorPrefix !== undefined ? opts.errorPrefix + ' ' : '';
          if (opts?.errorFactory !== undefined) {
            throw opts?.errorFactory(...buildRethrowErrorArgs(error, prefix + error.message));
          } else {
            throw new TypeError(...buildRethrowErrorArgs(error, prefix + error.message));
          }
        }
        throw error;
      }
    },
    assertArgs(whichFn: string, args: ArrayLike<unknown>) {
      const opts = {
        errorPrefix: `Received invalid arguments for ${whichFn}():`,
        at: '<argumentList>',
      };

      try {
        assertMatches(ruleset.rootRule, Array.from(args), ruleset.interpolated, opts.at);
      } catch (error) {
        // Rethrow as TypeError relatively low down the call stack, so we don't have too
        // many unnecessary stack frames in the call stack.
        if (error instanceof ValidatorAssertionError) {
          const prefix = opts?.errorPrefix !== undefined ? opts.errorPrefix + ' ' : '';
          const updatedMessage = rebuildAssertArgsMessage(ruleset.rootRule, prefix + error.message);
          throw new TypeError(...buildRethrowErrorArgs(error, updatedMessage));
        }
        throw error;
      }
    },
    matches(value: unknown): value is T {
      return doesMatch(ruleset.rootRule, value, ruleset.interpolated);
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
        rootRule: parse([unknownValue]),
        interpolated: [],
      }))
      : unknownValue;
  },

  createRef(): ValidatorRef {
    let validator: Validator | null = null;
    return {
      [packagePrivate]: {
        type: 'ref',
        getValidator(): Validator {
          if (validator === null) {
            throw new Error('Can not use a pattern with a ref until ref.set(...) has been called.');
          }
          return validator;
        },
      },
      set(validator_: Validator) {
        if (validator !== null) {
          throw new Error('Can not call ref.set(...) multiple times.');
        }
        validator = validator_;
      },
    };
  },

  expectTo(testExpectation: (valueBeingMatched: unknown) => string | null): Expectation {
    return {
      [packagePrivate]: { type: 'expectation', testExpectation },
    };
  },
};

Object.assign(uncheckedValidator, staticFields);

function buildRethrowErrorArgs(error: ValidatorAssertionError, message: string = error.message): any {
  // This version of TypeScript does not yet support error causes, which
  // is why we have to use the `any` type here.
  const errorOpts = (error as any).cause !== undefined
    ? { cause: (error as any).cause }
    : [];

  return [message, errorOpts];
}

// Takes a ValidationAssertionError message, and attempts to edit in the
// name of the argument that failed to match.
function rebuildAssertArgsMessage(rule: Rule, message: string): string {
  if (rule.category !== 'tuple') return message;
  if (rule.entryLabels === null) return message;

  const indexAsString = (
    /<argumentList>\[(\d+)\]/.exec(message)?.[1] ??
    /<argumentList>\.slice\((\d+)\)/.exec(message)?.[1]
  );
  if (indexAsString === undefined) return message;

  const index = Number(indexAsString);
  const label = rule.entryLabels[index];
  assert(label !== undefined);

  assert(message.startsWith('Received invalid arguments for'));
  const afterSlice = message.slice('Received invalid arguments for'.length);

  const isRestParam = rule.rest !== null && index === rule.entryLabels.length - 1;

  return (
    `Received invalid "${label}" argument${isRestParam ? 's' : ''} for` +
    afterSlice
  );
}
