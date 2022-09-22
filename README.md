# ETL Network Node

## Overview

The ETL network node is comprised of the `node`, `core` and `contracts`.

- `core` : This is the core library/package responsible for the blockchain. It contains utility functions responsible for the consensus layer and execution layer of the chain. it is a fork off [`KYVENetwork/core`](https://github.com/KYVENetwork/core),

- `node` : This is the code associated with the execution layer, it is our main source of concern as it contains the logic particular to the ETL process.

- `contracts` : This is the code associated with smart contracts.... coming soon....

## Running the node

#### Building/developing the core

If you intend making changes to the core library, perhaps make some changes to the execution layer or consensus layer of the chain, then run `yarn workspace @etl-network/core dev` such that when any file change is made, the core library is rebuilt and any package dependent on it can run off the latest version.

#### Starting the node

Assuming we have the core as we want it to be, the next stage in the development process is to start the node by running this command `yarn workspace @etl-network/node start:fresh`, this would build the latest version of the node and run it to start a validator node

##### TL;DR:

run:
`yarn workspace @etl-network/node start:fresh`

##### Important

To get started please include a keyfile.json file at the root of the node package.
