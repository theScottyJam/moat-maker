import { createValidatorAssertionError, ValidatorAssertionError } from '../exceptions';
import type { Rule } from '../types/parsingRules';
import { matchResponseFromErrorMap, FailedMatchResponse, stepVariantsBackTo, VariantMatchResponse } from './VariantMatchResponse';

interface BackLinks<NewRuleType extends Rule, OldRuleType extends Rule> {
  readonly lastInstance: UnionVariantCollection<OldRuleType>
  readonly lastVariants: Map<NewRuleType, OldRuleType>
}

/**
 * Contains a list of variants.
 * Similar to arrays, you can map or filter over this list to create derivative collections.
 * What's special about this class, is that it'll preserve information during these kinds of transformations
 * so when failures happen with some of the variants of a derived collection, you'll be able to walk backwards and
 * figure out which of the variants from the original collection have also failed because of it.
 */
export class UnionVariantCollection<RuleType extends Rule = Rule> {
  readonly variants: readonly RuleType[];
  /**
   * Information on how to link variants from a derived instance back to its source.
   * If you, e.g., do myCollection.map(...), the returned collection will have a backLinks property,
   * that's populated to link every new variant back to the original one. It also remembers what the
   * original collection instance is.
   */
  readonly backLinks: BackLinks<RuleType, Rule> | undefined;

  constructor(variants: readonly RuleType[], backLinks?: BackLinks<RuleType, Rule> | undefined) {
    this.variants = variants;
    this.backLinks = backLinks;
  }

  isEmpty(): boolean {
    return this.variants.length === 0;
  }

  filter(filterFn: (rule: RuleType) => boolean): UnionVariantCollection<RuleType> {
    const links = new Map<RuleType, Rule>();
    const newVariants: RuleType[] = [];
    for (const variant of this.variants) {
      if (filterFn(variant)) {
        newVariants.push(variant);
        links.set(variant, variant);
      }
    }

    return new UnionVariantCollection(newVariants, { lastInstance: this, lastVariants: links });
  }

  /**
   * Maps over each variant.
   * If `null` is returned, that specific result will be filtered out.
   */
  map<NewRuleType extends Rule>(
    mapFn: (rule: RuleType) => NewRuleType | null,
  ): UnionVariantCollection<NewRuleType> {
    const links = new Map<NewRuleType, RuleType>();
    const newVariants: NewRuleType[] = [];
    for (const variant of this.variants) {
      const newVariant = mapFn(variant);
      if (newVariant === null) {
        continue;
      }
      newVariants.push(newVariant);
      links.set(newVariant, variant);
    }

    return new UnionVariantCollection(newVariants, { lastInstance: this, lastVariants: links });
  }

  /**
   * Behaves the same as JavaScript's array.groups() (which, at the time of writing is a stage 3 proposal).
   */
  groups<K extends string>(
    grouper: (x: RuleType) => K,
    { keys }: { keys: readonly K[] },
  ): { [index in K]: UnionVariantCollection<RuleType> } {
    const rawResult = Object.fromEntries(
      keys.map(k => [k, [] as RuleType[]]),
    ) as { [index in K]: RuleType[] };

    for (const variant of this.variants) {
      const groupName = grouper(variant);
      rawResult[groupName].push(variant);
    }

    return Object.fromEntries(
      Object.entries(rawResult)
        .map(([key, variants_]) => {
          const variants = variants_ as RuleType[];
          const links = new Map<RuleType, RuleType>();
          for (const variant of variants) {
            links.set(variant, variant);
          }

          return [key, new UnionVariantCollection(variants, { lastInstance: this, lastVariants: links })];
        }),
    ) as { [index in K]: UnionVariantCollection<RuleType>; };
  }

  /**
   * Creates a derived collection, where all variants that failed in the provided matchResponse
   * will be omitted. If the matchResponse targets a derived collection, this function will automatically
   * "walk back" each variant to figure out which corresponding variant on this instance should be removed.
   *
   * Remember that the instance returned will be a derived instance, which means if you have another response
   * that targets the source collection or one of it's other derivatives, you won't be able to use it on the the
   * returned derivative, as that would be an independent derivation branch that's being followed. If you need to
   * work around this limitation, you can use a UnionVariantCollectionFilteredView instance, which lets you
   * apply multiple match responses to it, without creating new derivatives.
   */
  removeFailed(matchResponse: VariantMatchResponse<Rule>): UnionVariantCollection<RuleType> {
    return new UnionVariantCollectionFilteredView(this).removeFailed(matchResponse).asNewCollection();
  }

  /**
   * Takes a potentially nested set of union rules and flattens them.
   * e.g. (a | b) | c -> a | b | c
   */
  flattenUnions(): UnionVariantCollection {
    const flattenedVariantToUnflattenedVariant = new Map<Rule, RuleType>();

    for (const variant of this.variants) {
      for (const flattenedVariant of this.#flattenVariants([variant])) {
        flattenedVariantToUnflattenedVariant.set(flattenedVariant, variant);
      }
    }

    return new UnionVariantCollection([...flattenedVariantToUnflattenedVariant.keys()], {
      lastInstance: this,
      lastVariants: flattenedVariantToUnflattenedVariant,
    });
  }

  #flattenVariants(variants: readonly Rule[]): readonly Rule[] {
    return variants.flatMap(variant => {
      return variant.category === 'union'
        ? this.#flattenVariants(variant.variants)
        : [variant];
    });
  }

  /**
   * Iterates over each variant and the collection and calls the provided callback against each.
   * If ValidatorAssertionErrors are thrown, they're be captured and recorded.
   * A VariantMatchResponse instance will be return, containing information about the failures that
   * occurred during the match.
   *
   * This should only be used if you need to perform assertions with each variant individually. Sometimes,
   * what's needed instead is to make a derivative of the collection (with .map()), then match the derivative
   * as if it were a union.
   */
  matchEach(
    doAssertion: (variant: RuleType) => void,
  ): VariantMatchResponse<RuleType> {
    const variantToError = new Map<RuleType, ValidatorAssertionError>();
    for (const variant of this.variants) {
      try {
        doAssertion(variant);
      } catch (error) {
        if (error instanceof ValidatorAssertionError) {
          variantToError.set(variant, error);
        } else {
          throw error;
        }
      }
    }

    return matchResponseFromErrorMap(variantToError, this);
  }

  asFilteredView(): UnionVariantCollectionFilteredView<RuleType> {
    return new UnionVariantCollectionFilteredView(this);
  }

  /**
   * A continence method for creating a failure response, that's
   * targeting this collection (i.e. all variants in this collection will be marked as failed).
   */
  createFailResponse(message: string): FailedMatchResponse<RuleType> {
    return new FailedMatchResponse(
      createValidatorAssertionError(message),
      this,
    );
  }
}

/**
 * A filtered view of a UnionVariantCollection instance.
 * This allows you to interact with a filtered version of a collection, without literally making
 * a derivative of it, which can be important for variant-failure backtracking purposes, where
 * you may want to avoid branching out into new derivatives, because that means you can't apply
 * failed variants that branched from earlier instances.
 */
export class UnionVariantCollectionFilteredView<RuleType extends Rule> {
  #variantCollection: UnionVariantCollection<RuleType>;
  #remainingVariants: Set<RuleType>;
  constructor(variantCollection: UnionVariantCollection<RuleType>, opts?: { _remainingVariants: Set<RuleType> }) {
    this.#variantCollection = variantCollection;
    this.#remainingVariants = opts?._remainingVariants ?? new Set(variantCollection.variants);
  }

  /**
   * Returns a new filtered view of the same collection,
   * but with more variants filtered out from the view.
   */
  removeFailed(matchResponse: VariantMatchResponse<Rule>): UnionVariantCollectionFilteredView<RuleType> {
    const failedVariants = stepVariantsBackTo<RuleType>(
      matchResponse.failedVariants(),
      { from: matchResponse.variantCollection, to: this.#variantCollection },
    );

    const remainingVariants = new Set(this.#remainingVariants);
    for (const variant of failedVariants) {
      remainingVariants.delete(variant);
    }

    return new UnionVariantCollectionFilteredView(this.#variantCollection, { _remainingVariants: remainingVariants });
  }

  isEmpty(): boolean {
    return this.#remainingVariants.size === 0;
  }

  /**
   * Creates a new collection, as a derivative of the original collection this view is based on,
   * but with the appropriate variants filtered out.
   */
  asNewCollection(): UnionVariantCollection<RuleType> {
    return new UnionVariantCollection(
      [...this.#remainingVariants],
      {
        lastInstance: this.#variantCollection,
        lastVariants: new Map([...this.#remainingVariants].map(variant => [variant, variant])),
      },
    );
  }
}
