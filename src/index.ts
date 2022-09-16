import { parse, freezeRule } from './ruleParser';
import { assertMatches, doesMatch } from './ruleEnforcer';
import { Rule } from './types/parseRules';
import { Validator } from './types/validator';

export * from './exceptions';
export * from './types/parseRules';

export function validator(parts: TemplateStringsArray): Validator {
  return validator.fromRule(parse(parts));
}

validator.fromRule = function(rule_: Rule): Validator {
  const rule = freezeRule(rule_);

  return Object.freeze({
    assertMatches<T>(value: T): T {
      return assertMatches(rule, value);
    },
    matches(value: unknown) {
      return doesMatch(rule, value);
    },
    rule,
  });
};
