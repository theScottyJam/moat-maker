import type { LookupPath } from './LookupPath';
import type { Rule, TupleRule } from '../types/validationRules';
import { assert, reprUnknownValue } from '../util';
import { DEEP_LEVELS } from './deepnessTools';
import { match, type CheckFnResponse } from './ruleMatcherTools';

// The deep levels used in this module
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const availableDeepLevels = () => ({
  irrelevant: DEEP_LEVELS.irrelevant,
  typeCheck: DEEP_LEVELS.typeCheck,
  immediateInfoCheck: DEEP_LEVELS.immediateInfoCheck,
  recurseInwardsCheck: DEEP_LEVELS.recurseInwardsCheck,
});

export function tupleCheck(
  rule: TupleRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: LookupPath,
): CheckFnResponse {
  if (!Array.isArray(target)) {
    return [{
      message: `Expected ${lookupPath.asString()} to be an array but got ${reprUnknownValue(target)}.`,
      lookupPath,
      deep: availableDeepLevels().typeCheck,
      progress: -2,
    }];
  }

  const maybeErrorMessage = checkTupleSize(rule, target, lookupPath);
  if (maybeErrorMessage !== null) {
    return [{
      message: maybeErrorMessage,
      lookupPath,
      deep: availableDeepLevels().immediateInfoCheck,
      progress: -1,
    }];
  }

  for (const [subTargetIndex, subTarget] of target.entries()) {
    const tupleEntryRule = tupleEntryRuleFromIndex(subTargetIndex, rule);

    if (tupleEntryRule === null) {
      // Length checks should have already been done by this point,
      // so if an index is being passed in, and there isn't a required or optional
      // matching rule, then it must be matched via a rest rule.
      assert(rule.rest !== null);
      break;
    }

    const elementMatchResponse = match(
      tupleEntryRule,
      subTarget,
      interpolated,
      lookupPath.thenIndexArray(subTargetIndex),
    );

    if (elementMatchResponse.failed()) {
      return [{
        matchResponse: elementMatchResponse,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: subTargetIndex,
      }];
    }
  }

  if (rule.rest !== null) {
    const startIndex = rule.content.length + rule.optionalContent.length;
    const portionToTestAgainst = target.slice(startIndex);

    const restMatchResponse = match(
      rule.rest,
      portionToTestAgainst,
      interpolated,
      lookupPath.thenSliceArray({ from: startIndex }),
    );

    if (restMatchResponse.failed()) {
      return [{
        matchResponse: restMatchResponse,
        deep: availableDeepLevels().recurseInwardsCheck,
        progress: Infinity,
      }];
    }
  }

  return [];
}

function checkTupleSize(rule: TupleRule, target: readonly unknown[], lookupPath: LookupPath): string | null {
  const minSize = rule.content.length;
  const maxSize = rule.rest !== null
    ? Infinity
    : rule.content.length + rule.optionalContent.length;

  if (target.length < minSize || target.length > maxSize) {
    if (minSize === maxSize) {
      return (
        `Expected the ${lookupPath.asString()} array to have ` +
        `${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`
      );
    } else if (maxSize !== Infinity) {
      return (
        `Expected the ${lookupPath.asString()} array to have between ${minSize} and ${maxSize} entries, ` +
        `but found ${target.length}.`
      );
    } else {
      return (
        `Expected the ${lookupPath.asString()} array to have at least ` +
        `${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`
      );
    }
  }

  return null;
}

function tupleEntryRuleFromIndex(index: number, rule: TupleRule): null | Rule {
  const maybeRequiredEntry = rule.content[index];
  if (maybeRequiredEntry !== undefined) {
    return maybeRequiredEntry;
  }

  const maybeOptionalEntry = rule.optionalContent[index - rule.content.length];
  if (maybeOptionalEntry !== undefined) {
    return maybeOptionalEntry;
  }

  return null;
}
