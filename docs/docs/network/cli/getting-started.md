---
title: 'Getting Started'
sidebar_position: 1
---

## Overview

The Log Store CLI is a command-line tool for managing a staked balance to fund queries and data storage on the Log Store Network.

It is built using Node.js and allows users to interact with the network via a set of commands.

The CLI supports the following command-line options:

- `-h, --host <string>`: The RPC endpoint of the Polygon/EVM node to connect to (compulsory parameter).
- `-w, --wallet <string>`: The private key of the wallet to use for signing transactions (compulsory parameter).
- `-n, --network <string>`: The network to interact with (default: 'Dev').
- `-d, --debug`: Enables debug logging.
- `-u --usd`: Declares that the amount provided should be denominated in usd.

The following commands are available to be used:

- `version`: Prints the runtime and protocol version information.
- `query`: Manages Interaction with Log Store queries.
  - `stake`: Stakes tokens into the Query Manager Contract to submit query requests to the Log Store Network.
- `store`: Manages Log Stores.
  - `stake`: Stakes tokens into the Store Manager Contract to store data transported over a stream into the decentralised storage network.

## Installing the CLI

The Log Store Client can be installed using `npm`, `pnpm` or `yarn`.

```bash
npm i -g @logsn/cli
```

Then,

```bash
logstore-cli --help
```
