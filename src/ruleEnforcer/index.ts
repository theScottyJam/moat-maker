import { LookupPath } from './LookupPath';
import type { Rule } from '../types/validationRules';
import {
  buildValueMatchError,
  buildArgumentMatchError,
  type BuildValueMatchErrorOpts,
  type BuildArgumentMatchErrorOpts,
} from './errorMessageBuilder';
import { match } from './ruleMatcherTools';

export function matchValue(
  rule: Rule,
  target: unknown,
  interpolated: readonly unknown[],
  baseLookupPath?: string | undefined,
  errorFormattingOpts: BuildValueMatchErrorOpts = {},
): { success: true } | { success: false, message: string } {
  const matchResponse = match(rule, target, interpolated, new LookupPath(baseLookupPath));
  if (matchResponse.failed()) {
    return {
      success: false,
      message: buildValueMatchError(matchResponse, errorFormattingOpts),
    };
  } else {
    return { success: true };
  }
}

export function matchArgument(
  rule: Rule,
  target: unknown,
  interpolated: readonly unknown[],
  errorFormattingOpts: BuildArgumentMatchErrorOpts,
): { success: true } | { success: false, message: string } {
  const lookupPath = new LookupPath('<argumentList>', {
    customStringifier({ rootText, pathSegments }): string {
      const firstPathSegment = pathSegments[0];
      if (firstPathSegment !== undefined && firstPathSegment.category === 'indexArray') {
        return new LookupPath(
          `<argument #${firstPathSegment.index + 1}>`,
          { pathSegments: pathSegments.slice(1) },
        ).asString();
      }

      return new LookupPath(rootText, { pathSegments }).asString();
    },
  });

  const matchResponse = match(rule, target, interpolated, lookupPath);
  if (matchResponse.failed()) {
    return {
      success: false,
      message: buildArgumentMatchError(matchResponse, rule, errorFormattingOpts),
    };
  } else {
    return { success: true };
  }
}
