# Moat Maker

[Complete Documentation](https://thescottyjam.gitbook.io/moat-maker/)

Validate your runtime JavaScript data with easy to pick up, TypeScript-inspired syntax. It's as easy as:

```bash
npm i moat-maker
```

```javascript
import { validator } from 'moat-maker';

// (This is just a small taste of the kind
// of expressive power this tool can provide)
const userValidator = validator`{
  username: string // required string property
  age?: number // optional number property
  dateOfBirth: string | ${Date} // must be a string or Date object
}`;

// ✓ - This is valid.
userValidator.assertMatches({
  username: 'cookieMonster42',
  dateOfBirth: new Date(1969),
});

// ✕ - Expected <receivedValue>.age to be of type "number"
//     but got type "string".
userValidator.assertMatches({
  username: 'elmo77',
  age: "it's a secret",
  dateOfBirth: new Date(1984),
});
```

If you use CommonJS instead of ES Modules (i.e. you use `require()`, or your TS compiled output uses `require()`), you'll need to instead install [moat-maker-commonjs](https://github.com/theScottyJam/moat-maker-commonjs).

Moat Maker can be used anywhere where you might want to validate the correctness of your data, including:
* User-input validation. Build a solid validation wall around your business logic to ensure your API users don't try and provide any bad inputs. Helpful auto-generated error messages will be provided to your API users so they can know what needs to be fixed. (If you find any particular error message isn't as helpful as you would like, please [open an issue](https://github.com/theScottyJam/moat-maker/issues/new)).
* Validate HTTP responses, configuration, outputs from third-party libraries, etc, to make sure they all fit your expectations.
* Write expressive assertions in your automated tests.

This project strives to follow a number of code-quality standards to keep the tool flexible and useful for anyone who needs it. For you, this means you can expect this project to be:
* **Lightweight:** To keep out the bloat this project will be careful about what dependencies it chooses to drag in. Currently, this means it has zero dependencies. In the future, if there's demand for it, this project may be split up into smaller components that can be plugged together, allowing you to leave out the code from features you don't use.
* **Stable:** Breaking changes are taken seriously. If, for whatever reason your codebase breaks after an update, please [submit an issue](https://github.com/theScottyJam/moat-maker/issues/new) so it can be addressed.
* **Fast:** The results of parsing a template string will be cached, so you don't have to worry about the the performance penalty of defining your validators inside of functions vs outside. Attention has also been given to many other aspects of the validation process to try and keep it running smoothly. If you find validation to ever be the cause of significant performance issues in your application, please [file an issue](https://github.com/theScottyJam/moat-maker/issues/new) so it can be addressed.
* **Supported:** Bugs, feature suggestions, or questions? Go ahead and [start a discussion](https://github.com/theScottyJam/moat-maker/issues/new).
* **Open Source:** This project is licensed under the [MIT](https://github.com/theScottyJam/moat-maker/blob/main/LICENSE) license. Feel free to do with it as you wish.

## Why Moat Maker?

A number of existing runtime type-validation tools already exists in the JavaScript ecosystem, including:
* [Zod](https://github.com/colinhacks/zod) - build your schemas via function calls to produce both runtime validation and auto-built TypeScript types.
* [Ajv](https://github.com/ajv-validator/ajv) - validates the shape of your JSON data, using a schema defined in JSON. (similar to how XSD validates XML).
* [validator.js](https://github.com/mikeerickson/validatorjs) - Build your schema as a nested object, then validate your runtime data against that.
* And many, many more. Google around and you'll find them.

So why make another?

Many of the existing type-validation tools tend to exhibit similar issues:
* They can be cumbersome to use, due to the fact that they rely on function calls or nested object structures to define their schemas.
* There's a higher learning curve associated with these tools because they have a fairly large and unfamiliar API surface area.

Moat Maker set out to solve both of these problems by requiring schemas to be defined, not by nested objects or function calls, but with TypeScript syntax - a syntax that many JavaScript developers are already familiar with. This greatly reduced the learning curve for this project (in fact, all you really need to know to get started can be found in the "Quick Start" section below). Due to the concise nature of TypeScript's syntax, your schemas will feel much more light-weight and simple to understand.

If Moat Maker's goals don't align with yours, feel free to take a look at the great work these other projects have done to see if they offer what you need. You may also be interested in [ArkType](https://github.com/arktypeio/arktype), which has similar goals to Moat-Maker - it doesn't support quite as much TypeScript syntax, but it is capable of auto-generating TypeScript types from your schemas.

## Quick Start

Moat Maker supports all of the major syntactic features from TypeScript's type syntax, including syntax support for arrays, tuples, objects, unions, intersections, and more. If you want to know which TypeScript features are supported, take a look at [the overly detailed syntax reference](https://thescottyjam.gitbook.io/moat-maker/resources/syntax-reference), or just try it out and see what happens. Here's a quick taste of what is possible:

```javascript
validator`{
  arrayOfStringsOrNumbers: (string | number)[]
  canBeMissingOrBoolean?: boolean | undefined
  mustBe42: 42
  aOneOrTwoLengthedTupleOfBooleans: [boolean, boolean?]
  stringToNumberMapping: { [index: string]: number }

  // Generic matching, like Set<string>, can't be supported the same way
  // it exists in TypeScript. Instead, iterable-matching syntax is
  // provided among other tools to fill this gap.
  // This is the only piece of syntax you'll find that isn't also
  // provided by TypeScript.
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
// Passing in a class will require the user
// to provide an instance of the class.
validator`${Shape}`.assertMatches(new Shape());

// You can create more complicated validator
// instances by composing smaller ones.
const pointValidator = validator`{ x: number, y: number }`;
const lineValidator = validator`{
  start: ${pointValidator}
  end: ${pointValidator}
}`;
```

Finally, if you need a custom validation behavior that isn't supported by this library, the escape hatch is to create your own "expectations" using `validator.expectTo()`, then interpolating the resulting expectation instance wherever it is needed.

```javascript
// If a string is returned, it'll be used as part of the error message.
// The strings should complete the sentence: "Expect the value to ..."
const expectGreaterThanZero = validator.expectTo(value => {
  if (typeof value !== 'number' || value <= 0) {
    return 'be a number greater than zero.';
  }
});

const validatePositivePoint = validator`{
  x: ${expectGreaterThanZero}
  y: ${expectGreaterThanZero}
}`;

// ✕ - Expected <receivedValue>.y, which was -2,
//     to be a number greater than zero.
validatePositivePoint.assertMatches({
  x: 2,
  y: -2,
});
```

Please refer to [the docs](https://thescottyjam.gitbook.io/moat-maker/) for a more complete reference of what's possible. In the complete docs, you'll find information about what syntax is supported, what utility functions are provided, how you can customize parts of the error message if needed, and other, more-advance techniques this tool supports.
