# Log Store Validator Node

## Testing

`pnpm test`

or, for a specific test

`pnpm test -- -i runtime`

## Un-imported required dependencies

The following dependencies are not directly imported within this package, however, are required to successfully build the final CLI.

- `bigint-buffer`
- `@kyvejs/sdk`
- `aws-sdk`
- `mock-aws-s3`
- `nock`
