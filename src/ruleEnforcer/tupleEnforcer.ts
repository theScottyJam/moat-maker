import { strict as assert } from 'node:assert';
import { Rule, TupleRule, UnionRule } from '../types/parsingRules';
import { reprUnknownValue } from '../util';
import { createValidatorAssertionError } from '../exceptions';
import { assertMatches } from './ruleEnforcer';

export function assertMatchesTuple(
  rule: TupleRule,
  target: unknown,
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  const [tupleRule, targetTutple] = assertOutwardTupleCheck(rule, target, lookupPath);
  assertInwardTupleCheck([tupleRule], targetTutple, interpolated, lookupPath);
}

/**
 * Returns a tuple, where the first item is the passed-in rule and the second
 * is the received `target` parameter with no changes, except for the
 * fact that it's labels with the type `unknown[]` instead of `unknown`.
 */
export function assertOutwardTupleCheck(
  rule: TupleRule,
  target: unknown,
  lookupPath: string,
): [TupleRule, unknown[]] {
  if (!Array.isArray(target)) {
    throw createValidatorAssertionError(`Expected ${lookupPath} to be an array but got ${reprUnknownValue(target)}.`);
  }

  const minSize = rule.content.length;
  const maxSize = rule.rest !== null
    ? Infinity
    : rule.content.length + rule.optionalContent.length;

  if (target.length < minSize || target.length > maxSize) {
    if (minSize === maxSize) {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    } else if (maxSize !== Infinity) {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have between ${minSize} and ${maxSize} entries, ` +
        `but found ${target.length}.`,
      );
    } else {
      throw createValidatorAssertionError(
        `Expected the ${lookupPath} array to have at least ${minSize} ${minSize === 1 ? 'entry' : 'entries'}, but found ${target.length}.`,
      );
    }
  }

  // Returning `target`, but with the TS type of `unknown[]` instead of `unknown`.
  return [rule, target];
}

export function assertInwardTupleCheck(
  ruleVariants: readonly TupleRule[],
  target: unknown[],
  interpolated: readonly unknown[],
  lookupPath: string,
): void {
  assert(ruleVariants.length > 0);

  for (const variant of ruleVariants) {
    const restItems = [];
    for (const [i, element] of target.entries()) {
      const maybeSubRule = tupleEntryRuleAt(variant, i);
      if (maybeSubRule !== null && maybeSubRule.type !== 'rest') {
        assertMatches(maybeSubRule.rule, element, interpolated, `${lookupPath}[${i}]`);
      } else {
        restItems.push(element);
      }
    }

    if (variant.rest !== null) {
      const restStartIndex = variant.content.length + variant.optionalContent.length;
      const subPath = `${lookupPath}.slice(${restStartIndex})`;

      assertMatches(variant.rest, restItems, interpolated, subPath);
    }
  }
}

type TupleEntryRuleAtReturn = { rule: Rule, type: 'required' | 'optional' | 'rest' } | null;

function tupleEntryRuleAt(rule: TupleRule, index: number): TupleEntryRuleAtReturn {
  const maybeRequiredEntry = rule.content[index];
  if (maybeRequiredEntry !== undefined) {
    return { rule: maybeRequiredEntry, type: 'required' };
  }

  const maybeOptionalEntry = rule.optionalContent[index - rule.content.length];
  if (maybeOptionalEntry !== undefined) {
    return { rule: maybeOptionalEntry, type: 'optional' };
  }

  return rule.rest !== null
    ? { rule: rule.rest, type: 'rest' }
    : null;
}
