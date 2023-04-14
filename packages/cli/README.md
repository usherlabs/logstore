Documentation for the Logstore CLI :

The Log Store CLI is a command-line tool for querying and storing data on the Log Store Network. It is built using Node.js and allows users to interact with the network via a set of commands.

The CLI supports the following command-line options:

- `h, --host <string>`: The RPC endpoint of the Polygon/EVM node to connect to (compulsory parameter).
- `w, --wallet <string>`: The private key of the wallet to use for signing transactions (compulsory parameter).
- `n, --network <string>`: The network to interact with (default: 'Dev').
- `d, --debug`: Enables debug logging.

The following commands are available to be used:

- `version`: Prints the runtime and protocol version information.
- `query`: Manages Interaction with Log Store queries.
    - `stake`: Stakes tokens into the Query Manager Contract to submit query requests to the Log Store Network.
- `store`: Manages Log Stores.
    - `stake`: Stakes tokens into the Store Manager Contract to store data transported over a stream into the decentralised storage network.

## Example usage:

1) Before the log store can be queried, some amount needs to be staked by the consumer, and it is done as follows:

```
$ pnpm start query stake -h https://13.237.80.83:8546 --amount 1000000000000000000 --usd

```

This will stake 1 ETH worth of tokens into the Query Manager Contract.

2) In order to enable data from a stream to be stored, some amount needs to be staked against that stream, and it can be accomplished by the command:

```
$ pnpm start store stake <streamId> --amount 1000000000000000000 -h http://13.237.80.83:8546 -w ...

```

This will stake 1 ETH worth of tokens into the Store Manager Contract for the specified Stream ID.

```jsx
Note: The usd flag(—usd) is optional and it is used to denote if the amount passed in is to be denoted in usd. if it is not provided then the amount passed in is denoted in wei.

Note: Before using the CLI, you must have a valid wallet with sufficient funds and network access.
```