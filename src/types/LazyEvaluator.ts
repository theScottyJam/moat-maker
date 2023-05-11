// This is currently only used internally.
// Perhaps some time in the future this feature will be publicly exported.
// For now, to avoid risking publishing a feature that isn't properly polished up
// it'll be kept as an internal detail.

import type { packagePrivate } from '../packagePrivateAccess';
import type { Validator } from './validator';

/**
 * The deriveValidator() callback will be called when with a value
 * being validated. The callback is expected to return a validator instance,
 * which will then be used to validate the value. The callback will only be called
 * at the point when validation is happening at that rule - this allows you to perform
 * other assertions first, to make sure the data conforms to a certain shape, before
 * the callback is ran.
 *
 * The point is to allow you to use data from the object you're validating against, to
 * control the behavior of the validator.
 */
export interface LazyEvaluator {
  readonly [packagePrivate]: {
    readonly type: 'lazyEvaluator'
    readonly deriveValidator: (value: unknown) => Validator
  }
}
