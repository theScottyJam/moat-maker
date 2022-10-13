export class UnreachableCaseError extends Error {
  name = 'UnreachableCaseError';
  constructor(value: never) {
    super(`Unexpected value ${String(value)}`);
  }
}

export function reprUnknownValue(value: unknown): string {
  if (typeof value === 'function') {
    if (value.name === '') return '[anonymous function/class]'; // TODO: Test with a class
    return '`' + value.name + '`'; // TODO: Test with a class
  }

  if (typeof value === 'object' && value !== null) {
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    if (typeof name === 'string') {
      return `[object ${name}]`;
    } else {
      return Object.prototype.toString.call(value); // TODO: Test
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
  forEach(...args: Parameters<Map<K, V>['forEach']>) { return this.#content.forEach(...args); }
  keys(...args: Parameters<Map<K, V>['keys']>) { return this.#content.keys(...args); }
  values(...args: Parameters<Map<K, V>['values']>) { return this.#content.values(...args); }
  /* eslint-enable @typescript-eslint/explicit-function-return-type */
}

// This TypeScript pipe() definition comes from https://dev.to/ecyrbe/how-to-use-advanced-typescript-to-define-a-pipe-function-381h
// One day, JavaScript/TypeScript will have a native pipe operator, at which point we can remove this
// mess and use that instead.

type AnyFunc = (...arg: any) => any;

type PipeArgs<F extends AnyFunc[], Acc extends AnyFunc[] = []> = F extends [
  (...args: infer A) => infer B
]
  ? [...Acc, (...args: A) => B]
  : F extends [(...args: infer A) => any, ...infer Tail]
    ? Tail extends [(arg: infer B) => any, ...any[]]
      ? PipeArgs<Tail, [...Acc, (...args: A) => B]>
      : Acc
    : Acc;

type LastFnReturnType<F extends AnyFunc[], Else = never> = F extends [
  ...any[],
  (...arg: any) => infer R
] ? R : Else;

export function pipe<FirstFn extends AnyFunc, F extends AnyFunc[]>(
  arg: Parameters<FirstFn>[0],
  firstFn: FirstFn,
  ...fns: PipeArgs<F> extends F ? F : PipeArgs<F>
): LastFnReturnType<F, ReturnType<FirstFn>> {
  return (fns as AnyFunc[]).reduce((acc, fn) => fn(acc), firstFn(arg));
}
