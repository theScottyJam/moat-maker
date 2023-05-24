import type { Expectation, ValidatorTemplateTag } from './types/validator';
import { isDirectInstanceOf, reprUnknownValue } from './util';

export function expectDirectInstanceFactory(validator: ValidatorTemplateTag) {
  return (targetClass: new (...params: any[]) => any) => validator.expectTo((value): string | null => {
    return isDirectInstanceOf(value, targetClass)
      ? null
      : `be a direct instance of ${reprUnknownValue(targetClass)}.`;
  });
}

export function expectNonSparseFactory(validator: ValidatorTemplateTag): Expectation {
  return validator.expectTo((array: unknown) => {
    if (!Array.isArray(array)) return 'be an array.';
    for (let i = 0; i < array.length; i++) {
      if (!(i in array)) {
        return `not be a sparse array. Found a hole at index ${i}.`;
      }
    }

    return null;
  });
}

export function expectKeysFromFactory(validator: ValidatorTemplateTag) {
  return (keys_: readonly string[]) => {
    const keys = new Set(keys_);
    return validator.expectTo((object): string | null => {
      // Loops through all enumerable and non-enumerable own properties.
      // Does not check symbols - unrecognized symbols can slide.
      for (const key of Object.getOwnPropertyNames(object)) {
        if (!keys.has(key)) {
          return `have only known keys. ${JSON.stringify(key)} is not recognized as a valid key.`;
        }
      }

      return null;
    });
  };
}
