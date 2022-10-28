import { strict as assert } from 'node:assert';
import { CacheEntry } from './types/cacheControl';
import { Rule } from './types/parsingRules';

interface CacheRecord {
  value: Rule | null
  furtherContent: Map<string, CacheRecord>
}

let cacheRoot: CacheRecord = {
  value: null,
  furtherContent: new Map(),
};

export function lookupCacheEntry(keys: readonly string[]): CacheEntry {
  return {
    exists() {
      return findValueInCache(keys, cacheRoot) !== null;
    },
    get() {
      const value = findValueInCache(keys, cacheRoot);
      if (value === null) {
        throw new Error('Failed to find a requested value in the cache');
      }
      return value;
    },
    set(value: Rule) {
      setValueInCache(keys, cacheRoot, value);
    },
  };
}

function findValueInCache(keys: readonly string[], cacheRecord: CacheRecord): Rule | null {
  if (keys[0] === undefined) {
    return cacheRecord.value;
  }

  const subRecord = cacheRecord.furtherContent.get(keys[0]);
  if (subRecord === undefined) {
    return null;
  }

  return findValueInCache(keys.slice(1), subRecord);
}

function setValueInCache(keys: readonly string[], cacheRecord: CacheRecord, newValue: Rule): void {
  if (keys[0] === undefined) {
    assert(cacheRecord.value === null, 'Attempted to override an existing cache entry');
    cacheRecord.value = newValue;
    return;
  }

  let subRecord = cacheRecord.furtherContent.get(keys[0]);
  if (subRecord === undefined) {
    subRecord = { value: null, furtherContent: new Map() };
    cacheRecord.furtherContent.set(keys[0], subRecord);
  }

  setValueInCache(keys.slice(1), subRecord, newValue);
}

export const testableHelpers = {
  getCacheEntryFor(keys: TemplateStringsArray, ...interpolated: null[]) {
    return lookupCacheEntry(keys.raw);
  },
  clearCache() {
    cacheRoot = {
      value: null,
      furtherContent: new Map(),
    };
  },
};
