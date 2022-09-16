export class UnreachableCaseError extends Error {
  name = 'UnreachableCaseError';
  constructor(value: never) {
    super(`Unexpected value ${String(value)}`);
  }
}
