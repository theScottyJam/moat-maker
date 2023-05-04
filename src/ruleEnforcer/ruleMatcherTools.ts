import type { Rule } from '../types/validationRules';
import { assert, group, UnreachableCaseError } from '../util';
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

// With both progress values and deepness values, these numbers should either stay the same
// or increase as you get further into a check algorithm. They should never decrease.
// (The way we error messages are built, and lowest progress/deep ones are dropped rely on this behavior).
export type CheckFnResponse = ReadonlyArray<(
  {
    readonly message: string
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
  interpolated: readonly unknown[],
  lookupPath: string
) => CheckFnResponse;

export class MatchResponse {
  readonly for: Rule['category'];
  readonly lookupPath: string;
  readonly failures: CheckFnResponse;
  constructor(category: Rule['category'], lookupPath: string, failures: CheckFnResponse) {
    this.for = category;
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
  interpolated: readonly unknown[],
  lookupPath: string,
): MatchResponse {
  const doMatch = <RuleType extends Rule>(rule: RuleType, checkFn: CheckFn<RuleType>): MatchResponse => {
    const failures = checkFn(rule, target, interpolated, lookupPath);
    return new MatchResponse(rule.category, lookupPath, failures);
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

export function gatherErrorMessagesFor(matchResponses: readonly MatchResponse[]): readonly string[] {
  const responseToErrors = gatherErrorMessagesFor_(matchResponses);

  const errors: string[] = [];
  for (const response of matchResponses) {
    errors.push(...responseToErrors.get(response) ?? []);
  }

  return errors;
}

export function gatherErrorMessagesFor_(
  matchResponses: readonly MatchResponse[],
): Map<MatchResponse, readonly string[]> {
  const responseToErrors = new Map<MatchResponse, string[]>();
  const groupedByPath = (
    Object.values(group(matchResponses, m => m.lookupPath)) as
    ReadonlyArray<readonly MatchResponse[]>
  );
  for (const responsesAtSamePath of groupedByPath) {
    const groupedByType = group(responsesAtSamePath, r => r.for);
    const furthestFailures = Object.values(groupedByType).flatMap(responsesOfSameType => {
      const failures = responsesOfSameType
        .flatMap(result => result.failures.map(failure => ({ failure, originResult: result })));

      assert(failures.length > 0);
      const farThreshold = Math.max(...failures.map(({ failure }) => failure.progress ?? -Infinity));
      return failures.filter(({ failure }) => (failure.progress ?? -Infinity) === farThreshold);
    });

    const deepThreshold = Math.max(...furthestFailures.flatMap(
      ({ failure }) => calcCheckResponseDeepness(failure).map(deep => deep.start),
    ));
    const deepestAndFurthestFailures = furthestFailures
      .filter(({ failure }) => calcCheckResponseDeepness(failure).every(deep => deep.end >= deepThreshold));

    const subResponseToErrors = gatherErrorMessagesFor_(
      deepestAndFurthestFailures.flatMap(({ failure }) => {
        return 'matchResponse' in failure ? [failure.matchResponse] : [];
      }),
    );

    // Collect error messages, ensuring order is preserved.
    for (const { failure, originResult } of deepestAndFurthestFailures) {
      const errors = responseToErrors.get(originResult) ?? [];
      if ('message' in failure) {
        errors.push(failure.message);
      } else {
        errors.push(...subResponseToErrors.get(failure.matchResponse) ?? []);
      }
      responseToErrors.set(originResult, errors);
    }
  }

  return responseToErrors;
}

export function calcCheckResponseDeepness(matchResponse: CheckFnResponse[number]): DeepRange[] {
  if (matchResponse.deep !== 'INHERIT') {
    return [matchResponse.deep];
  } else {
    assert('matchResponse' in matchResponse);
    return matchResponse.matchResponse.failures.flatMap(resp => calcCheckResponseDeepness(resp));
  }
}
