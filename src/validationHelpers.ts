import type { ValidatorTemplateTag } from './types/validator';
import { isDirectInstanceOf, reprUnknownValue } from './util';

export function expectDirectInstanceFactory(validator: ValidatorTemplateTag) {
  return (targetClass: new (...params: any[]) => any) => validator.expectTo((value): string | null => {
    return isDirectInstanceOf(value, targetClass)
      ? null
      : `be a direct instance of ${reprUnknownValue(targetClass)}.`;
  });
}
