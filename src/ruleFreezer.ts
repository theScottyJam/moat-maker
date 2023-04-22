import type { ObjectRuleContentValue, ObjectRuleIndexValue, Rule, Ruleset } from './types/validationRules';
import { UnreachableCaseError, FrozenMap } from './util';

interface FreezeRuleSetOpts {
  readonly assumeRootRuleIsDeepFrozen: boolean
}

export function freezeRuleset(ruleset: Ruleset, opts?: FreezeRuleSetOpts): Ruleset {
  return Object.freeze({
    rootRule: opts?.assumeRootRuleIsDeepFrozen === true
      ? ruleset.rootRule
      : freezeRule(ruleset.rootRule),
    interpolated: Object.freeze([...ruleset.interpolated]),
  });
}

function freezeRule(rule: Rule): Rule {
  if (rule.category === 'simple') {
    return f({
      category: rule.category,
      type: rule.type,
    });
  } else if (rule.category === 'primitiveLiteral') {
    return f({
      category: rule.category,
      value: rule.value,
    });
  } else if (rule.category === 'noop') {
    return f({
      category: rule.category,
    });
  } else if (rule.category === 'object') {
    const freezeContentValue = (contentValue: ObjectRuleContentValue): ObjectRuleContentValue => f({
      optional: contentValue.optional,
      rule: freezeRule(contentValue.rule),
    });
    const freezeIndexValue = (indexValue: ObjectRuleIndexValue): ObjectRuleIndexValue => f({
      key: freezeRule(indexValue.key),
      value: freezeRule(indexValue.value),
      label: indexValue.label,
    });
    return f({
      category: rule.category,
      content: new FrozenMap(
        [...rule.content.entries()]
          .map(([k, v]) => f([k, freezeContentValue(v)])),
      ),
      dynamicContent: new FrozenMap(
        [...rule.dynamicContent.entries()]
          .map(([k, v]) => f([k, freezeContentValue(v)])),
      ),
      index: rule.index === null ? null : freezeIndexValue(rule.index),
    });
  } else if (rule.category === 'array') {
    return f({
      category: rule.category,
      content: freezeRule(rule.content),
    });
  } else if (rule.category === 'tuple') {
    return f({
      category: rule.category,
      content: f(rule.content.map(entry => freezeRule(entry))),
      optionalContent: f(rule.optionalContent.map(entry => freezeRule(entry))),
      rest: rule.rest === null ? null : freezeRule(rule.rest),
      entryLabels: rule.entryLabels === null ? null : f(rule.entryLabels),
    });
  } else if (rule.category === 'iterator') {
    return f({
      category: rule.category,
      iterableType: freezeRule(rule.iterableType),
      entryType: freezeRule(rule.entryType),
    });
  } else if (rule.category === 'union') {
    return f({
      category: rule.category,
      variants: f(rule.variants.map(variant => freezeRule(variant))),
    });
  } else if (rule.category === 'intersection') {
    return f({
      category: rule.category,
      variants: f(rule.variants.map(variant => freezeRule(variant))),
    });
  } else if (rule.category === 'interpolation') {
    return f({
      category: rule.category,
      interpolationIndex: rule.interpolationIndex,
    });
  } else {
    throw new UnreachableCaseError(rule);
  }
}

/** shallow-copy-and-freeze function */
const f = <T>(objOrArray: T): T => {
  if (Object.isFrozen(objOrArray)) {
    return objOrArray;
  }
  return Object.freeze(
    Array.isArray(objOrArray) ? [...objOrArray] : { ...objOrArray },
  ) as T;
};
