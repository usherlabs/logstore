# Logstore Cli

The Log Store CLI is a command-line tool for querying and storing data on the Log Store Network.

## Documentation

[👉 See full documentation of the Log Store CLI](https://docs.logstore.usher.so/network/cli/getting-started)

## Installing the CLI

The Log Store Client can be installed using `npm`, `pnpm` or `yarn`.
Depending on your unique setup and configuration, you may need to use the sudo command.

```bash
npm i -g @logsn/cli
```

## Usage

The command `logstore help` returns a list of all commands and option flags.

```shel
Usage: Log Store CLI [options] [command]

Query and Store on the Log Store Network.

Options:
  -V, --version            output the version number
  -h, --host <string>      Polygon/EVM Node RPC Endpoint
  -w, --wallet <string>    Wallet private key
  -c, --config <string>    Path to configuration file. Default to ~/.logstore-cli/default.json
  -d, --debug              Show debug logs
  --help                   display help for command

Commands:
  version                  Print runtime and protocol version
  init [options]           Creates a configuration file with default parameters
  balance [options]        View the LSAN token balance in your wallet, and available storage to use.
  mint [options] <amount>  Mint LSAN tokens for the Log Store Network
  query                    Manage your Log Store Queries
  store                    Manage your Log Stores
  create-stream <name>     Create Streamr stream to start storing data transported over the stream.
  help [command]           display help for command
```

## Examples

1. Before the Log Store Network can be queried, some [amount of LSAN](https://docs.logstore.usher.so/network/cli/mint-lsan) needs to be staked:

```
$ logstore query stake --amount 1000000000000000000 --usd -h https://polygon_rpc_url

```

1. In order to enable data from a stream to be stored, some [amount of LSAN](https://docs.logstore.usher.so/network/cli/mint-lsan) needs to be staked against that Streamr Network stream/topic:

```
$ logstore store stake <streamId> --amount 1000000000000000000 -h https://polygon_rpc_url -w ...

```
