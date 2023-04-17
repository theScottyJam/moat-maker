import { strict as assert } from 'node:assert';
import { indentMultilineString } from '../util';
import { createValidatorAssertionError, type ValidatorAssertionError } from '../exceptions';
import type { Rule } from '../types/parsingRules';
import type { UnionVariantCollection } from './UnionVariantCollection';
import { buildUnionError } from './shared';

/**
 * A VariantMatchResponse is returned by match functions, to provide
 * information about the results of the match.
 *
 * If the overall match was successful, then a SuccessMatchResponse instance can be returned,
 * which will contain which variants did fail (if any).
 *
 * If the overall match was unsuccessful, then a FailedMatchResponse instance can be returned,
 * which will contain the actual error.
 */
export interface VariantMatchResponse<RuleType extends Rule> {
  /**
   * When you perform a match, you do it with a provided variantCollection.
   * The match response contains information about which variants from that collection failed.
   * The collection that was used is recorded here in the response.
   */
  readonly variantCollection: UnionVariantCollection<RuleType>

  /**
   * If the response was successful, this will return the variants that failed.
   * If the response was not successful, this will return all variants from the target variant collection.
   */
  readonly failedVariants: () => readonly RuleType[]

  /**
   * If this is a failed response, throws the contained error.
   */
  readonly throwIfFailed: () => void
}

export class SuccessMatchResponse<RuleType extends Rule> implements VariantMatchResponse<RuleType> {
  readonly #failedVariants: readonly RuleType[];
  readonly variantCollection: UnionVariantCollection<RuleType>;
  constructor(
    failedVariants: readonly RuleType[],
    variantCollection: UnionVariantCollection<RuleType>,
  ) {
    assert(
      failedVariants.length !== variantCollection.variants.length || failedVariants.length === 0,
      'Internal error: Attempted to construct a success response, when all variants in it had failed validation.',
    );
    this.#failedVariants = failedVariants;
    this.variantCollection = variantCollection;
  }

  /**
   * Helper for creating a success response that has no failed variants.
   */
  static createEmpty<RuleType extends Rule>(
    variantCollection: UnionVariantCollection<RuleType>,
  ): SuccessMatchResponse<RuleType> {
    return new SuccessMatchResponse([], variantCollection);
  }

  failedVariants(): readonly RuleType[] {
    return this.#failedVariants;
  }

  throwIfFailed(): void {
    // no-op
  }
}

export class FailedMatchResponse<RuleType extends Rule> implements VariantMatchResponse<RuleType> {
  readonly error: ValidatorAssertionError;
  readonly variantCollection: UnionVariantCollection<RuleType>;
  readonly deep: number;
  constructor(
    overallError: ValidatorAssertionError,
    variantCollection: UnionVariantCollection<RuleType>,
    { deep }: { readonly deep: number },
  ) {
    this.error = overallError;
    this.variantCollection = variantCollection;
    this.deep = deep;
  }

  failedVariants(): readonly RuleType[] {
    return this.variantCollection.variants;
  }

  throwIfFailed(): never {
    throw this.error;
  }

  /**
   * You can use this to retarget an overall error from one variant collection to another.
   * One consequence of this is that all variants on the new target will be counted as having failed.
   */
  asFailedResponseFor<T extends Rule>(
    variantCollection: UnionVariantCollection<T>,
  ): FailedMatchResponse<T> {
    return new FailedMatchResponse<T>(this.error, variantCollection, { deep: this.deep });
  }
}

// ------------------------------------------ //
// Utilities for working with match responses //
// ------------------------------------------ //

/**
 * A helper for generating the correct response instance.
 *
 * Given a mapping of variants to their errors, along with the collection that holds those variants,
 * this will return either a success response (if only some of the variants failed but not all),
 * or a failed response (if all variants failed). If it's a failed response, the error message will
 * be correctly formatted to contain a union-style error with all of the errors from the map.
 */
export function matchResponseFromErrorMap<RuleType extends Rule>(
  variantToError: Map<RuleType, ValidatorAssertionError>,
  targetCollection: UnionVariantCollection<RuleType>,
  { deep }: { readonly deep: number },
): VariantMatchResponse<RuleType> {
  if (variantToError.size === targetCollection.variants.length) {
    const unionError = buildUnionError(
      [...variantToError.values()]
        .map(err => err.message),
    );
    return new FailedMatchResponse(unionError, targetCollection, { deep });
  }
  return new SuccessMatchResponse([...variantToError.keys()], targetCollection);
}

/**
 * Takes a list of responses, steps them back to a common ancestor,
 * then merges them. Only supports building a success response,
 * if a failed response would be built, an error is thrown instead.
 */
export function mergeMatchResultsToSuccessResult(matchResponses: ReadonlyArray<VariantMatchResponse<Rule>>): VariantMatchResponse<Rule> {
  assert(matchResponses.length > 0);

  const getAncestorChain = (variantCollection: UnionVariantCollection): readonly UnionVariantCollection[] => {
    const rest = variantCollection.backLinks !== undefined
      ? getAncestorChain(variantCollection.backLinks.lastInstance)
      : [];

    return [variantCollection, ...rest];
  };

  const findCommonAncestor = (
    ancestorChains: ReadonlyArray<readonly UnionVariantCollection[]>,
  ): UnionVariantCollection => {
    const [firstChain, ...otherChains] = ancestorChains;
    assert(firstChain !== undefined);
    assert(firstChain.length > 0);

    const lastInvalidIndex = findLastIndex(firstChain, (collection, i) => {
      return otherChains.every(chain => chain[i] !== collection);
    });

    const firstValidIndex = lastInvalidIndex === -1 ? 0 : lastInvalidIndex + 1;
    assert(firstChain[firstValidIndex] !== undefined, 'Failed to find a common ancestor when merging results');
    return firstChain[firstValidIndex] as UnionVariantCollection;
  };

  const commonCollection = findCommonAncestor(
    matchResponses.map(response => getAncestorChain(response.variantCollection)),
  );

  const failedVariants = new Set<Rule>();
  for (const response of matchResponses) {
    const steppedBackVariants = stepVariantsBackTo(response.failedVariants(), {
      from: response.variantCollection,
      to: commonCollection,
    });

    for (const variant of steppedBackVariants) {
      failedVariants.add(variant);
    }
  }

  assert(
    failedVariants.size !== commonCollection.variants.length,
    'Internal error: Merging variants to create a failed response is not supported',
  );
  return new SuccessMatchResponse([...failedVariants], commonCollection);
}

/**
 * Given a list of variants that are found in the opts.from variant collection,
 * this function will walk backwards to find the corresponding failed variants
 * in the opts.to collection.
 */
export function stepVariantsBackTo<RuleType extends Rule>(
  variants: readonly Rule[],
  opts: {
    readonly from: UnionVariantCollection<Rule>
    readonly to: UnionVariantCollection<RuleType>
  },
): readonly RuleType[] {
  const { from: startCollection, to: targetCollection } = opts;

  let curVariants = variants;
  let curCollection = startCollection;
  while (true) {
    if (curCollection === targetCollection) {
      break;
    }

    curVariants = stepVariantsBackwards(
      curVariants,
      curCollection,
    );
    assert(curCollection.backLinks !== undefined);
    curCollection = curCollection.backLinks.lastInstance;
  }

  return curVariants as RuleType[];
}

/**
 * Takes the list of variants that are found in the provided variantCollection, and
 * steps them backwards by one step, to find the corresponding variants in the previous collection.
 */
function stepVariantsBackwards(
  failedVariants: readonly Rule[],
  variantCollection: UnionVariantCollection<Rule>,
): readonly Rule[] {
  const flipMapCache = new Map<Map<unknown, unknown>, Map<unknown, unknown[]>>();
  function flipMap<K, V>(source: Map<K, V>): Map<V, K[]> {
    const cachedTarget = flipMapCache.get(source);
    if (cachedTarget !== undefined) {
      return cachedTarget as Map<V, K[]>;
    }

    const target = new Map<V, K[]>();
    flipMapCache.set(source, target);
    for (const [key, value] of source) {
      setDefaultAndGet(target, value, []).push(key);
    }

    return target;
  }

  const blockersToFulfillers = new Map<Rule[], Set<Rule>>();
  const backLinks = variantCollection.backLinks;
  assert(
    backLinks !== undefined,
    'Attempted to step back further than able. ' +
    'This error usually happens when you attempt to have a failure ' +
    'do side-steps or some other kind of jump. Only backward steps are supported.',
  );
  const forwardLinks = flipMap(backLinks.lastVariants);

  const newFailedVariants = new Set<Rule>();
  for (const variant of failedVariants) {
    const lastVariant = backLinks.lastVariants.get(variant);
    assert(lastVariant !== undefined);

    // Sometimes (e.g. in the case of union flattening), it takes multiple failed variants
    // to link back to the next variant (because there was a one-to-many relationship going forwards).
    const variantsRequiredToProceed = forwardLinks.get(lastVariant);
    assert(variantsRequiredToProceed !== undefined);
    if (variantsRequiredToProceed.length !== 1) {
      const blockFulfillers = setDefaultAndGet(blockersToFulfillers, variantsRequiredToProceed, new Set());
      assert(variantsRequiredToProceed.includes(variant));
      blockFulfillers.add(variant);
      if (blockFulfillers.size !== variantsRequiredToProceed.length) {
        // Stop following this chain.
        // The next variant that gets here might be able to add enough to the blockFulfillers set
        // to push passed this blocker area.
        continue;
      }
    }

    newFailedVariants.add(lastVariant);
  }

  return [...newFailedVariants];
}

// ------------------------------
//   UTILITY FUNCTIONS
// ------------------------------

function setDefaultAndGet<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }

  return map.get(key) as any;
}

// This function was only recently added to the language.
// Perhaps at a later point, I can drop this "polyfill" and use the native one instead.
function findLastIndex<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): number {
  for (const [i, value] of [...array.entries()].reverse()) {
    if (predicate(value, i)) {
      return i;
    }
  }

  return -1;
}
