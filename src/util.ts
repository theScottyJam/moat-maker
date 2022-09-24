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

  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return String(value) + 'n';
  if (value === null) return 'null';
  return String(value);
}
