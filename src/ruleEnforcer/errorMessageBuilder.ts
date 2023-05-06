/*
----- ERROR PRUNING ALGORITHM -----

When a union of rules fails, there's lot of potential errors that can be shown, but only a few of
them really matter. A lot of the logic in here is for trying to decide which errors to prune. It's a tricky problem -
you don't want to prune too much, because you might accidentally prune the error the user cares about, but you also
don't want to prune to little and flood the user with errors.

We start with a tree structure who's nodes represent rules that were followed down, and who's leaves contains the error messages. Multiple branches can be traversed at once if the lookup paths and rule categories are the same. This, however, is a bit flakey - in the current implementation, doing something as simple as interpolating a validator could prevent this multi-branch-at-once behavior, because things aren't line up quite right anymore for it to work. There are ways to fix this, e.g. by looking up interpolated refs and validators first before trying to go deeper, but it's not a high priority issue.

When looking at a group of like-type rules at the same lookup path, we'll check what the highest "progress" value on them is. Any error that has a lower progress value will be discarded.

When looking at a group at the same lookup path, we'll check what the highest "deep" value on them is. Any error that has a lower deep value will be discarded. Some errors have a range of deep values - the "start" of the range is used when determining what the highest deepness value in the group is, while the "end" of the range is used to decide if a particular error should be discarded.

Any time an error shows up, who's lookup path is the parent of another errors lookup path, it will be discarded. e.g. an error at "a.b" will be discarded if there's also an error centered at "a.b.c". The exception is if the parent error is specifically a custom expectation - we want to make sure custom-built errors show up when they should, and those have the chance of digging deep into the object when matching, so even though the expectation may have ran on "a.b", the custom expectation itself may be checking information on the ".c" property of what it's inspecting.
*/

import type { LookupPath, PathSegment } from './LookupPath';
import type { Rule } from '../types/validationRules';
import { assert, group, indentMultilineString, throwIndexOutOfBounds } from '../util';
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

  const pathSegments = errorInfos[0]?.lookupPath.pathSegments ?? throwIndexOutOfBounds();
  const firstPathSegment = pathSegments[0];
  if (firstPathSegment === undefined) return genericPrefix + message;

  const getLabelIndex = (pathSegment: PathSegment): number | null => {
    assert(rule.entryLabels !== null);
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
  readonly isExpectationBeingInterpolated: boolean
}

function gatherErrorMessagesFor(matchResponses: readonly MatchResponse[]): readonly VariantErrorInfo[] {
  const responseToErrors = gatherErrorMessagesFor_(matchResponses);

  const errorInfos: VariantErrorInfo[] = [];
  for (const response of matchResponses) {
    errorInfos.push(...responseToErrors.get(response) ?? []);
  }

  const filteredErrors = filterOutLowerErrors(errorInfos);
  assert(filteredErrors.length > 0, 'Empty error list found after filtering unnecessary errors.');
  return filteredErrors;
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
      .filter(({ failure }) => calcCheckResponseDeepness(failure).some(deep => deep.end >= deepThreshold));

    const subResponseToErrors = gatherErrorMessagesFor_(
      deepestAndFurthestFailures.flatMap(({ failure }) => {
        return 'matchResponse' in failure ? [failure.matchResponse] : [];
      }),
    );

    // Collect error messages, ensuring order is preserved.
    for (const { failure, originResult } of deepestAndFurthestFailures) {
      const errors = responseToErrorInfos.get(originResult) ?? [];
      if ('message' in failure) {
        errors.push({
          message: failure.message,
          lookupPath: failure.lookupPath,
          isExpectationBeingInterpolated: originResult.isExpectationBeingInterpolated(),
        });
      } else {
        errors.push(...subResponseToErrors.get(failure.matchResponse) ?? []);
      }
      responseToErrorInfos.set(originResult, errors);
    }
  }

  return responseToErrorInfos;
}

/** If one error is found at a.b, and another at a.b.c, this will remove the "a.b" one. */
function filterOutLowerErrors(errorInfos: readonly VariantErrorInfo[]): readonly VariantErrorInfo[] {
  const res = errorInfos.filter(errorInfo => {
    if (errorInfo.isExpectationBeingInterpolated) return true;
    return errorInfos.every(iterErrorInfo => {
      if (iterErrorInfo === errorInfo) return true;
      return !iterErrorInfo.lookupPath.isParentOf(errorInfo.lookupPath);
    });
  });
  return res;
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
