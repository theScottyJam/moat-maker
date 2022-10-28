import { Rule } from './parsingRules';

export interface CacheEntry {
  readonly exists: () => boolean
  readonly get: () => Rule
  readonly set: (value: Rule) => void
}
