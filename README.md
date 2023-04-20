# Moat Maker

**Beta Warning:** Most features are complete. The small handful of features that are still being worked on is marked in [the extended documentation](https://app.gitbook.com/s/YOh5ZUUyIWGqXAqSjtfW/). There is also some minor work that will happen around some edge-case behaviors. You can expect a fair amount of stability at this point, but no promises.

Validate your runtime JavaScript data with easy to pick up, TypeScript-inspired syntax. It's as easy as:

```javascript
import { validator } from 'moat-maker';

const userValidator = validator`{
  username: string // required string property
  age?: number // optional number property
  dateOfBirth: string | ${Date} // must be a string, or an instance of Date
}`;

// ✓ - This is valid.
userValidator.assertMatches({
  username: 'cookieMonster42',
  dateOfBirth: new Date(1969),
});

// ✕ - Expected <receivedValue>.age to be of type "number" but got type "string".
userValidator.assertMatches({
  username: 'elmo77',
  age: "it's a secret",
  dateOfBirth: new Date(1984),
});
```

This tool can be used anywhere where you might want to validate the correctness of your data, including in:
* User-input validation. Build a solid validation wall around your business logic to ensure your API users don't try and provide any bad inputs. Helpful auto-generated error messages will be provided to your API users so they can know what needs to be fixed. (If you find any particular error message isn't as helpful as you would like, please [open an issue](https://github.com/theScottyJam/moat-maker/issues/new) and let us know).
* Validate HTTP responses, configuration, outputs from third-party libraries, etc, to make sure they all fit your expectations.
* Write expressive assertions in your automated tests.

This project strives to follow a number of code-quality standards to keep the tool flexible and useful for anyone who needs it. For you, this means you can expect this project to be:
* **Lightweight:** To keep out the bloat, this project has a zero-dependencies policy.
* **Stable:** Aside from bug-fixes or rare exceptions, once a behavior is public, it's not coming back out. If, for whatever reason your codebase breaks after an update, please [let us know](https://github.com/theScottyJam/moat-maker/issues/new) so it can be addressed. (NOTE: This principle only applies once Moat Maker is out of beta. Expect frequent changes to the API until then).
* **Fast:** The hand-built parser is designed to be fast. And the built-in caching system will cause the parsing step to be skipped entirely when the same template string is re-used.
* **Supported:** Bugs or feature suggestions? Please leave your thoughts in a [github issue](https://github.com/theScottyJam/moat-maker/issues/new). Every raised issue will be responded to and handled appropriately.
* **Open Source:** This project is licensed under the [MIT](https://github.com/theScottyJam/moat-maker/blob/main/LICENSE) license. Feel free to do with it as you wish.

## Why Moat Maker?

A number of existing runtime type-validation tools already exists in the JavaScript ecosystem, including:
* [Zod](https://github.com/colinhacks/zod) - build your schemas via function calls to produce both runtime validation and auto-built TypeScript types.
* [Ajv](https://github.com/ajv-validator/ajv) - validates the shape of your JSON data, using a schema defined in JSON. (similar to how XSD validates XML).
* [validator.js](https://github.com/mikeerickson/validatorjs) - Build your schema as a nested object, then validate your runtime data against that.
* And many, many more. Google around and you'll find them.

So why make another?

The existing type-validation tools all tend to exhibit similar issues:
* They can be cumbersome to use, due to the fact that they rely on function calls or nested object structures to define their schemas.
* There's a higher learning curve associated with these tools, due to the fact that they have a fairly large and unfamiliar API surface area.

Moat Maker set out to solve both of these problems by requiring schemas to be defined, not by nested objects or function calls, but with TypeScript syntax - a syntax that many JavaScript developers are already familiar with. This greatly reduced the learning curve for this project (in fact, all you really need to know to get started can be found in the "Quick Start" section below). Due to the concise nature of TypeScript's syntax, your schemas will feel much more light-weight and simple to understand.

If Moat Maker's goals don't align with yours, feel free to take a look at the great work these other projects have done to see if they offer what you need.

## Quick Start

Moat Maker supports all of the major syntactic features from TypeScript's type syntax, including syntax support for arrays, tuples, objects, unions, intersections, and more. If you want to know which TypeScript features are supported, take a look at the [syntax cheat sheet](https://thescottyjam.gitbook.io/moat-maker/resources/syntax-cheat-sheet), or just try it out and see what happens. Here's a quick taste of what is possible:

```javascript
validator`{
  arrayOfStringsOrNumbers: (string | number)[]
  canBeMissingOrBoolean?: boolean | undefined
  mustBe42: 42
  aOneOrTwoLengthedTupleOfBooleans: [boolean, boolean?]
  stringToNumberMapping: { [index: string]: number }

  // Generic matching, like Set<string>, can't be supported the same way
  // it exists in TypeScript. Instead, iterable-matching syntax is provided
  // among other tools to fill this gap.
  mustBeASetThatYieldsStringsWhenIterated: ${Set}@<string>
}`
```

Additionally, because Moat Maker is built on template literals, you're allowed to interpolate runtime values you wish to match against. Interpolating different types of values will cause different matching behaviors to happen, for example:

```javascript
// This can only be matched with the number `42`.
validator`${42}`.assertMatches(42);

// This will only accept an array of `true`s.
validator`${true}[]`.assertMatches([true, true, true]);

class Shape {}
// Passing in a class (or function, since classes are functions)
// will require the user to provide an instance of the class.
validator`${Shape}`.assertMatches(new Shape());

// You can create more complicated validator instances by composing smaller ones.
const pointValidator = validator`{ x: number, y: number }`;
const lineValidator = validator`{ start: ${pointValidator}, end: ${pointValidator} }`;
```

Finally, if you need a custom validation behavior that isn't supported by this library, the escape hatch is to create your own "expectations" using `validator.expectTo()`, then interpolating the resulting expectation instance wherever it is needed.

```javascript
// If a string is returned, it'll be used as part of the error message.
// The strings should complete the sentence: "Expected the value to ..."
const expectGreaterThanZero = validator.expectTo(
  value => typeof value === 'number' && value > 0
    ? null
    : 'be a number greater than zero.'
);

validatePositivePoint = validator`{
  x: ${expectGreaterThanZero}
  y: ${expectGreaterThanZero}
}`;

// ✕ - Expected <receivedValue>.y, which was -2, to be a number greater than zero.
validatePositivePoint.assertMatches({
  x: 2,
  y: -2,
});
```

Please refer to [the docs](https://thescottyjam.gitbook.io/moat-maker/) for a more complete reference of what's possible. In the complete docs, you'll find information about what syntax is supported, what utility functions are provided, how you can customize parts of the error message if needed, and other, more-advance techniques this tool supports.
