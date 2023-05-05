import type { LookupPath, PathSegment } from './LookupPath';
import type { Rule } from '../types/validationRules';
import { assert, group, indentMultilineString } from '../util';
import { calcCheckResponseDeepness, type MatchResponse } from './ruleMatcherTools';

export interface BuildValueMatchErrorOpts {
  readonly errorPrefix?: string | undefined
}

export function buildValueMatchError(
  matchResponse: MatchResponse,
  { errorPrefix: rawErrorPrefix }: BuildValueMatchErrorOpts,
): string {
  const prefix = rawErrorPrefix !== undefined ? rawErrorPrefix + ' ' : '';
  const message = buildUnionError(gatherErrorMessagesFor([matchResponse]).map(({ message }) => message));
  return prefix + message;
}

export interface BuildArgumentMatchErrorOpts {
  readonly whichFn: string
}

export function buildArgumentMatchError(
  matchResponse: MatchResponse,
  rule: Rule,
  { whichFn }: BuildArgumentMatchErrorOpts,
): string {
  const genericPrefix = `Received invalid arguments for ${whichFn}(): `;
  const errorInfos = gatherErrorMessagesFor([matchResponse]);
  const message = buildUnionError(errorInfos.map(({ message }) => message));

  if (rule.category !== 'tuple') return genericPrefix + message;
  if (rule.entryLabels === null) return genericPrefix + message;

  const pathSegments = errorInfos[0]?.lookupPath.pathSegments;
  assert(pathSegments !== undefined);
  const firstPathSegment = pathSegments[0];
  if (firstPathSegment === undefined) return genericPrefix + message;

  const getLabelIndex = (pathSegment: PathSegment): number | null => {
    assert(rule.entryLabels !== null);
    let label: string | undefined;
    if (pathSegment.category === 'indexArray') {
      return pathSegment.index;
    } else if (pathSegment.category === 'sliceArray') {
      return pathSegment.from;
    } else {
      return null;
    }
  };

  const labelIndex = getLabelIndex(firstPathSegment);
  if (labelIndex === null) {
    return genericPrefix + message;
  }

  for (const errorInfo of errorInfos.slice(1)) {
    const iterPathSegment = errorInfo.lookupPath.pathSegments[0];
    if (iterPathSegment === undefined) {
      continue;
    }

    const iterLabelIndex = getLabelIndex(iterPathSegment);
    if (labelIndex !== iterLabelIndex) {
      // Theoretically it's not possible to reach this point due to the fact that the top-level
      // rule must be a tuple, and tuples will only give an error for a single entry at once.
      // But, if that algorithm were to ever change, we have this bit of logic here to fall back on,
      // to make sure this error-message-building stuff still works fine.
      return genericPrefix + message;
    }
  }

  const label = rule.entryLabels[labelIndex];
  assert(label !== undefined);
  const isRestParam = rule.rest !== null && labelIndex === rule.entryLabels.length - 1;

  return (
    `Received invalid "${label}" argument${isRestParam ? 's' : ''} for ${whichFn}(): ` +
    message
  );
}

interface VariantErrorInfo {
  readonly message: string
  readonly lookupPath: LookupPath
}

function gatherErrorMessagesFor(matchResponses: readonly MatchResponse[]): readonly VariantErrorInfo[] {
  const responseToErrors = gatherErrorMessagesFor_(matchResponses);

  const errorInfos: VariantErrorInfo[] = [];
  for (const response of matchResponses) {
    errorInfos.push(...responseToErrors.get(response) ?? []);
  }

  return errorInfos;
}

function gatherErrorMessagesFor_(
  matchResponses: readonly MatchResponse[],
): Map<MatchResponse, readonly VariantErrorInfo[]> {
  const responseToErrorInfos = new Map<MatchResponse, VariantErrorInfo[]>();
  const groupedByPath = (
    Object.values(group(matchResponses, m => m.lookupPath.asString())) as
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
      const errors = responseToErrorInfos.get(originResult) ?? [];
      if ('message' in failure) {
        errors.push({ message: failure.message, lookupPath: failure.lookupPath });
      } else {
        errors.push(...subResponseToErrors.get(failure.matchResponse) ?? []);
      }
      responseToErrorInfos.set(originResult, errors);
    }
  }

  return responseToErrorInfos;
}

/**
 * Turns a list of errors into a single union-style error.
 * Duplicate messages are automatically filtered out.
 */
export function buildUnionError(variantErrorMessages_: readonly string[]): string {
  const variantErrorMessages = unique(variantErrorMessages_);
  if (variantErrorMessages.length === 1) {
    assert(variantErrorMessages[0] !== undefined);
    return variantErrorMessages[0];
  }

  return (
    'Failed to match against any variant of a union.\n' +
    variantErrorMessages
      .map((message, i) => `  Variant ${i + 1}: ${indentMultilineString(message, 4).slice(4)}`)
      .join('\n')
  );
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function unique<T>(array: readonly T[]): readonly T[] {
  return [...new Set(array)];
}
