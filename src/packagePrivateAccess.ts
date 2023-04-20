/**
 * Some module's entire content is publicly exported, even though there's a small handful of things.
 * it exports that are really only intended to be used internally. So, they're "locked" behind this
 * packagePrivate symbol, to discourage outside actors from using it.
 *
 * This is also used on exported objects, where data on those objects needs to be shared with the rest
 * this package, but not with the outside world.
 */
export const packagePrivate = Symbol('internals');
