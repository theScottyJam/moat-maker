# Developing here

When asserting errors, Node's `assert.throws()` is used instead of Jest's `expect(...).toThrow()`, because Node's `.throws()` will check the entire error message against the provided string, while Jest's `.toThrow()` will just check if the provided string is contained inside the original error message.