# ETL Network Node

## Overview

The ETL network node is comprised of the `node`, `core` and `contracts`.

- `node` : This is the code associated with the execution layer, it is our main source of concern as it contains the logic particular to the ETL process.

- `contracts` : This is the code associated with smart contracts using hardhat

## Running the node
 Firstly clone the core package locally, then run npm run link in the package's repo, then run `npm run link @kyve/core` inside this monorepo
#### Starting the node

Assuming we have the core as we want it to be, the next stage in the development process is to start the node by running this command `yarn workspace @etl-network/node start:fresh`, this would build the latest version of the node and run it to start a validator node

##### TL;DR:

run:
`yarn workspace @etl-network/node start:fresh`

##### Important

To get started please include a keyfile.json file at the root of the node package.
