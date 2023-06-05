# Log Store Validator Node

The Node is highly dependent on the [Kyve Protocol Node](https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/README.md).

## Testing

`pnpm test`

or, for a specific test

`pnpm test -- -i runtime`

## Un-imported required dependencies

The following dependencies are not directly imported within this package, however, are required to successfully build the final CLI.

- `bigint-buffer`
- `@kyvejs/sdk`
