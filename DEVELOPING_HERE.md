# Coding guidelines

Provide JSDocs for all public functions and interfaces.

Stick to supported Node features, as explained in the "Managing the Node version" section below.

Some interfaces are exported with the intention that the end-user will be implementing it (e.g. they may implement the ArrayRule interface, but should never be implementing the Validator interface). Adding new properties to these interfaces should be considered a breaking change. Just make sure to correctly update the semver number in these cases.

# Testing guidelines

When asserting errors, Node's `assert.throws()` is used instead of Jest's `expect(...).toThrow()`, because Node's `.throws()` will check the entire error message against the provided string, while Jest's `.toThrow()` will just check if the provided string is contained inside the original error message.

Except for cases where the intention is to only check for part of the error - then `expect(...).toThrow()` can be used.

# Documentation guidelines

Just make sure to use title case for section headings. I'm prone to forgetting this - hopefully this note here will help to occasionally remind me.

# Publishing to NPM

The workflow for publishing will generally go as follows:
* Run `nvm use` to make sure you're on the correct version of Node.
* Run `npm run prepublishOnly` to make sure everything will be able to publish without issue.
* Update the version number in package.json.
* Add these changes to a "Update version to X.X.X" commit.
* Add a version tag to this commit in GitHub
* Run `npm publish` to publish the branch.

# Managing the Node version

Stick to JavaScript features that are available in [any version of Node that's currently in maintenance](https://github.com/nodejs/release#release-schedule). The version of Node this package currently supports is found in package.json under the "engines" key as well as .nvmrc - if you ever need to bump the supported Node version number, you can update those two locations.

To test that the project is working properly in the oldest supported version of node, make sure you have `nvm` installed then run:

```sh
nvm use # Use the version found in .nvmrc
npm test
```
