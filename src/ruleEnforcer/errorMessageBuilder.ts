/*
----- ERROR PRUNING ALGORITHM -----

When a union of rules fails, there's lot of potential errors that can be shown, but only a few of
them really matter. A lot of the logic in here is for trying to decide which errors to prune. It's a tricky problem -
you don't want to prune too much, because you might accidentally prune the error the user cares about, but you also
don't want to prune to little and flood the user with errors.

We start with a tree structure who's nodes represent rules that were followed down, and who's leaves contains the error messages. Multiple branches can be traversed at once if the lookup paths and rule categories are the same. This, however, is a bit flakey - in the current implementation, doing something as simple as interpolating a validator could prevent this multi-branch-at-once behavior, because things aren't line up quite right anymore for it to work. There are ways to fix this, e.g. by looking up interpolated lazy-evaluators and validators first before trying to go deeper, but it's not a high priority issue.

When looking at a group of like-type rules at the same lookup path, we'll check what the highest "progress" value on them is. Any error that has a lower progress value will be discarded.

When looking at a group at the same lookup path, we'll check what the highest "deep" value on them is. Any error that has a lower deep value will be discarded. Some errors have a range of deep values - the "start" of the range is used when determining what the highest deepness value in the group is, while the "end" of the range is used to decide if a particular error should be discarded.

Any time an error shows up, who's lookup path is the parent of another errors lookup path, it will be discarded. e.g. an error at "a.b" will be discarded if there's also an error centered at "a.b.c". The exception is if the parent error is specifically a custom expectation - we want to make sure custom-built errors show up when they should, and those have the chance of digging deep into the object when matching, so even though the expectation may have ran on "a.b", the custom expectation itself may be checking information on the ".c" property of what it's inspecting.

In JavaScript, it's a common pattern to have a union of different objects who all have some sort of "type" property
that's set to unique strings (or in some cases, numbers). An attempt is made to detect these "type" properties. If one is found, and the target object's type property value corresponds to one particular union variant, than all other variant errors will be discarded. A property is believed to be a "type" property if:
- On each variant, the property's rule is a PrimitiveLiteralRule who's value is either a string or a number.
- The value of this PrimitiveLiteralRule is unique for each variant.
- There's only one such property that follows the above rules.
*/

import type { LookupPath, PathSegment } from './LookupPath.js';
import type { Rule } from '../types/validationRules.js';
import { assert, group, indentMultilineString, throwIndexOutOfBounds } from '../util.js';
import { calcCheckResponseDeepness, type CheckFnResponse, type MatchResponse } from './ruleMatcherTools.js';
import { comparePrimitiveLiterals } from './privitiveLiteralEnforcer.js';
import { isExpectation } from '../types/validator.js';

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
  const genericPrefix = `Received invalid arguments for ${whichFn}: `;
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

  // Gets the entry label at the index, and if it's out of bounds (undefined), we must be in a rest rule,
  // so we'll just grab the last entry label.
  const label = rule.entryLabels[labelIndex] ?? rule.entryLabels[rule.entryLabels.length - 1] ?? throwIndexOutOfBounds();

  const isRestParam = rule.rest !== null && labelIndex >= rule.entryLabels.length - 1;

  return (
    `Received invalid "${label}" argument${isRestParam ? 's' : ''} for ${whichFn}: ` +
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
    const groupedByType = group(responsesAtSamePath, r => r.rule.category);
    const furthestFailures = Object.values(groupedByType).flatMap(responsesOfSameType => {
      const failures_ = responsesOfSameType
        .flatMap(result => result.failures.map(failure => ({ failure, originResult: result })));

      const failures = filterByVariantIdentifyingProperty(failures_);

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
          isExpectationBeingInterpolated: (
            originResult.rule.category === 'interpolation' &&
            isExpectation(originResult.interpolated[originResult.rule.interpolationIndex])
          ),
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

interface FailureInfo {
  readonly failure: CheckFnResponse[number]
  readonly originResult: MatchResponse
}

/**
 * Tries to look for a variant-identifying property in the various object patterns,
 * that is used to determine which union variant you're trying to conform to.
 * If a property is found that looks like it behaves like this
 * (i.e. it can be used to identify which variant is being targeted - often this is a "type" property),
 * and if the value being matched correctly conforms to this found property,
 * than all other errors will be discarded.
 */
function filterByVariantIdentifyingProperty(failureInfos: readonly FailureInfo[]): readonly FailureInfo[] {
  const firstFailureInfo = failureInfos[0] ?? throwIndexOutOfBounds();
  if (firstFailureInfo.originResult.rule.category !== 'property') {
    return failureInfos;
  }

  // Maps candidate property names to the potential values they could be set to.
  const candidateProperties = new Map<string, Set<unknown>>(
    [...firstFailureInfo.originResult.rule.content.keys()]
      .map(key => [key, new Set([])]),
  );
  for (const { originResult } of failureInfos) {
    assert(originResult.rule.category === 'property');
    for (const key of candidateProperties.keys()) {
      const propertyRuleInfo = originResult.rule.content.get(key);
      const isCanidate = (
        propertyRuleInfo !== undefined &&
        !propertyRuleInfo.optional &&
        propertyRuleInfo.rule.category === 'primitiveLiteral' &&
        (['string', 'number'] as string[]).includes(typeof propertyRuleInfo.rule.value)
      );

      if (!isCanidate) {
        candidateProperties.delete(key);
        continue;
      }

      const propSet = candidateProperties.get(key);
      if (propSet === undefined) {
        continue;
      }

      const primitiveValue = propertyRuleInfo.rule.value;
      if (propSet.has(primitiveValue)) {
        // Each variant must have a unique value for it to be a candidate.
        candidateProperties.delete(key);
      } else {
        propSet.add(primitiveValue);
      }
    }
  }

  // Failed to find exactly one variant-identifying property
  if (candidateProperties.size !== 1) {
    return failureInfos;
  }

  const [candidateEntry] = candidateProperties;
  assert(candidateEntry !== undefined);
  const variantIdentifyingKey = candidateEntry[0];

  for (const failureInfo of failureInfos) {
    const { originResult } = failureInfo;
    if (!isObject(originResult.target)) {
      return failureInfos;
    }

    // Later on, once support is better, this can be replaced with Object.hasOwn()
    if (!Object.prototype.hasOwnProperty.call(originResult.target, variantIdentifyingKey)) {
      return failureInfos;
    }

    assert(originResult.rule.category === 'property');
    const propertyRuleInfo = originResult.rule.content.get(variantIdentifyingKey);
    assert(propertyRuleInfo !== undefined);
    assert(propertyRuleInfo.rule.category === 'primitiveLiteral');
    const primitiveValue = propertyRuleInfo.rule.value;
    if (comparePrimitiveLiterals(primitiveValue, (originResult.target as any)[variantIdentifyingKey])) {
      // We found the one matching failure info. Lets return just that one.
      return [failureInfo];
    }
  }

  return failureInfos;
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
    'One of the following issues needs to be resolved:\n' +
    variantErrorMessages
      .map(message => `  * ${indentMultilineString(message, 4).slice(4)}`)
      .join('\n')
  );
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function isObject(value: unknown): value is object {
  return value === Object(value);
}

function unique<T>(array: readonly T[]): readonly T[] {
  return [...new Set(array)];
}
