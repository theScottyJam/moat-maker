/**
 * Some module's entire content is publicly exported, even though there's a small handful of things.
 * it exports that are really only intended to be used internally. So, they're "locked" behind this
 * packagePrivate symbol, to discourage outside actors from using it.
 */
export const packagePrivate = Symbol('internals');
