---
title: 'Getting Started'
sidebar_position: 1
---

## Overview

The Log Store CLI is a command-line tool to mint new LSAN Tokens and manage a staked balance to fund queries and data storage on the Log Store Network.

It is built using Node.js and allows users to interact with the network via a set of commands.

The CLI supports the following command-line options:

- `h, --host <string>`: The RPC endpoint of the Polygon/EVM node to connect to (compulsory parameter).
- `w, --wallet <string>`: The private key of the wallet to use for signing transactions (compulsory parameter).
- `n, --network <string>`: The network to interact with (default: 'Dev').
- `d, --debug`: Enables debug logging.
- `u --usd`: Declares that the amount provided should be denominated in usd.

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

### Minting LSAN Tokens with CLI

To get started with LogStore, you will need an amount of LSAN. One way of having it is minting new LSAN tokens from MATIC. We’ve facilitated this by including this command in our CLI:

The **`mint`** command is used to mint LSAN tokens for the Log Store Network.

Here is the usage and structure of the **`mint`** command:

```
mint lsan <amount> [-u, --usd]
```

This command requires an argument **`<amount>`**, the amount in MATIC Wei to convert into new LSAN tokens.

The optional **`-u, --usd`** flag can be passed in if you want to specify the amount in USD. The command will automatically convert this to the appropriate amount of token to stake.

The successful execution of the command will output a message indicating the transaction hash and the amount minted.

Once you have minted LSAN tokens, you can use them to stake and interact with the Log Store Network.
