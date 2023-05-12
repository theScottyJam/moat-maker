import type { Rule } from '../types/validationRules';
import { assert, UnreachableCaseError } from '../util';
import type { DeepRange } from './deepnessTools';
import { arrayCheck } from './arrayEnforcer';
import { interpolationCheck } from './interpolationEnforcer';
import { intersectionCheck } from './intersectionEnforcer';
import { iterableCheck } from './iterableEnforcer';
import { noopCheck } from './noopEnforcer';
import { objectCheck } from './objectEnforcer';
import { primitiveLiteralCheck } from './privitiveLiteralEnforcer';
import { simpleCheck } from './simpleEnforcer';
import { tupleCheck } from './tupleEnforcer';
import { unionCheck } from './unionEnforcer';
import type { LookupPath } from './LookupPath';
import type { InterpolatedValue } from '../types/validator';

// With both progress values and deepness values, these numbers should either stay the same
// or increase as you get further into a check algorithm. They should never decrease.
// (The way we error messages are built, and lowest progress/deep ones are dropped rely on this behavior).
export type CheckFnResponse = ReadonlyArray<(
  {
    readonly message: string
    readonly lookupPath: LookupPath
    readonly deep: DeepRange
    readonly progress?: number
  } | {
    readonly matchResponse: MatchResponse
    readonly deep: DeepRange
    readonly progress?: number
  } | {
    readonly matchResponse: MatchResponse
    // Setting this to 'INHERIT' means you want the original deepness values of entries in matchResponse
    // to be used, instead of overriding it with a new value.
    readonly deep: 'INHERIT'
    readonly progress?: undefined
  }
)>;

type CheckFn<RuleType extends Rule> = (
  rule: RuleType,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath
) => CheckFnResponse;

export class MatchResponse {
  readonly rule: Rule;
  readonly target: unknown;
  readonly interpolated: readonly InterpolatedValue[];
  readonly lookupPath: LookupPath;
  readonly failures: CheckFnResponse;
  constructor(
    rule: Rule,
    target: unknown,
    interpolated: readonly InterpolatedValue[],
    lookupPath: LookupPath,
    failures: CheckFnResponse,
  ) {
    this.rule = rule;
    this.target = target;
    this.interpolated = interpolated;
    this.lookupPath = lookupPath;
    this.failures = failures;
  }

  failed(): boolean {
    return this.failures.length > 0;
  }
}

export function match(
  rule: Rule,
  target: unknown,
  interpolated: readonly InterpolatedValue[],
  lookupPath: LookupPath,
): MatchResponse {
  const doMatch = <RuleType extends Rule>(rule: RuleType, checkFn: CheckFn<RuleType>): MatchResponse => {
    const failures = checkFn(rule, target, interpolated, lookupPath);
    return new MatchResponse(rule, target, interpolated, lookupPath, failures);
  };

  if (rule.category === 'simple') return doMatch(rule, simpleCheck);
  else if (rule.category === 'primitiveLiteral') return doMatch(rule, primitiveLiteralCheck);
  else if (rule.category === 'noop') return doMatch(rule, noopCheck);
  else if (rule.category === 'object') return doMatch(rule, objectCheck);
  else if (rule.category === 'array') return doMatch(rule, arrayCheck);
  else if (rule.category === 'tuple') return doMatch(rule, tupleCheck);
  else if (rule.category === 'iterable') return doMatch(rule, iterableCheck);
  else if (rule.category === 'union') return doMatch(rule, unionCheck);
  else if (rule.category === 'intersection') return doMatch(rule, intersectionCheck);
  else if (rule.category === 'interpolation') return doMatch(rule, interpolationCheck);
  else throw new UnreachableCaseError(rule);
}

export function calcCheckResponseDeepness(matchResponse: CheckFnResponse[number]): DeepRange[] {
  if (matchResponse.deep !== 'INHERIT') {
    return [matchResponse.deep];
  } else {
    assert('matchResponse' in matchResponse);
    return matchResponse.matchResponse.failures.flatMap(resp => calcCheckResponseDeepness(resp));
  }
}
