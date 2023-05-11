export function assert(condition: boolean, message = 'Assertion Failed'): asserts condition {
  if (!condition) {
    throw new Error('Internal Error: ' + message);
  }
}

export class UnreachableCaseError extends Error {
  name = 'UnreachableCaseError';
  constructor(value: never) {
    super(`Unexpected value ${String(value)}`);
  }
}

/** Used when you wish to access an array element that you know must exist, and you need to tell TypeScript of this.
 * e.g. `myArray[0]?.sub.prop ?? throwIndexOutOfBounds()`
 */
export function throwIndexOutOfBounds(): never {
  throw new Error('Internal error: Attempted to index an array with an out-of-bounds index.');
}

// Will be available natively once the `array.groups()` proposal goes through
// (at the time of writing, this proposal is at stage 3).
export function group<K extends string, V>(
  items: readonly V[],
  grouper: (x: V) => K,
): { [index in K]?: readonly V[] } {
  const result: Partial<{ [index in K]: V[] }> = {} as any;
  for (const item of items) {
    const groupName = grouper(item);
    (result[groupName] ??= []).push(item);
  }

  return result;
}

export function indentMultilineString(multilineString: string, amount: number): string {
  return multilineString.split('\n').map(line => ' '.repeat(amount) + line).join('\n');
}

export function reprUnknownValue(value: unknown): string {
  if (typeof value === 'function') {
    if (value.name === '') return '[anonymous function/class]';
    return '`' + value.name + '`';
  }

  if (typeof value === 'object' && value !== null) {
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    if (typeof name === 'string') {
      return `[object ${name}]`;
    } else {
      return Object.prototype.toString.call(value);
    }
  }

  if (typeof value === 'string') {
    if (value.length > 55) {
      return JSON.stringify(value.slice(0, 50) + '…');
    } else {
      return JSON.stringify(value);
    }
  }
  if (typeof value === 'bigint') return String(value) + 'n';
  if (value === null) return 'null';
  return String(value);
}

const englishOrdinalRules = new Intl.PluralRules('en', { type: 'ordinal' });
/** Converts numbers like `2` to the string `'2nd'`. */
export function asOrdinal(number: number): string {
  const suffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' } as const;
  const suffix = suffixes[englishOrdinalRules.select(number) as 'one' | 'two' | 'few' | 'other'];
  return String(number) + suffix;
}

export class FrozenMap<K, V> {
  #content: Map<K, V>;
  constructor(entries: ReadonlyArray<[K, V]>) {
    this.#content = new Map(entries);
  }

  /* eslint-disable @typescript-eslint/explicit-function-return-type */
  get size(): number { return this.#content.size; }
  [Symbol.iterator]() { return this.#content[Symbol.iterator](); }
  entries(...args: Parameters<Map<K, V>['entries']>) { return this.#content.entries(...args); }
  get(...args: Parameters<Map<K, V>['get']>) { return this.#content.get(...args); }
  has(...args: Parameters<Map<K, V>['has']>) { return this.#content.has(...args); }
  forEach(...args: Parameters<Map<K, V>['forEach']>) { this.#content.forEach(...args); }
  keys(...args: Parameters<Map<K, V>['keys']>) { return this.#content.keys(...args); }
  values(...args: Parameters<Map<K, V>['values']>) { return this.#content.values(...args); }
  /* eslint-enable @typescript-eslint/explicit-function-return-type */
}

// This TypeScript pipe() definition comes from https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h
// One day, JavaScript/TypeScript will have a native pipe operator, at which point we can remove this
// mess and use that instead.

type AnyFunc = (...arg: any) => any;

type PipeArgs<F extends AnyFunc[], Acc extends AnyFunc[] = []> = F extends [
  (...args: infer A) => infer B,
]
  ? [...Acc, (...args: A) => B]
  : F extends [(...args: infer A) => any, ...infer Tail]
    ? Tail extends [(arg: infer B) => any, ...any[]]
      ? PipeArgs<Tail, [...Acc, (...args: A) => B]>
      : Acc
    : Acc;

type LastFnReturnType<F extends AnyFunc[], Else = never> = F extends [
  ...any[],
  (...arg: any) => infer R,
] ? R : Else;

export function pipe<FirstFn extends AnyFunc, F extends AnyFunc[]>(
  arg: Parameters<FirstFn>[0],
  firstFn: FirstFn,
  ...fns: PipeArgs<F> extends F ? F : PipeArgs<F>
): LastFnReturnType<F, ReturnType<FirstFn>> {
  return (fns as AnyFunc[]).reduce((acc, fn) => fn(acc), firstFn(arg));
}
