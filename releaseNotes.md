# Release Notes

## Version 1.0.0
Released May 26, 2023

The initial release!
* Syntax that is available to be used in this release: Simple rules (number/string/object/etc), primitive literals, any/unknown, property rules (the object-like syntax), arrays, tuples, unions, intersection, and iterable matching syntax. Parentheses and comments also work as expected.
* Supported values that can be interpolated into a validator: primitives, classes (and functions), regular expressions, and special objects provided by this library.
* Available properties on the validator instance: .matches(), .assertMatches(), .assertionTypeGuard(), .assertArgs(), and .ruleset
* Available static properties found on the validator template tag: .from(), .fromRuleset(), .lazy(), .expectTo()
* Other available exports: ValidatorSyntaxError
