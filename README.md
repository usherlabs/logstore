# ETL Network Node

## Overview

The ETL network node is comprised of the `node`, `core` and `contracts`.

- `node` : This is the code associated with the execution layer, it is our main source of concern as it contains the logic particular to the ETL process.

- `contracts` : This is the code associated with smart contracts using hardhat

## Development environment

1. Setup the **Streamr development environment** follwing its [instructions](https://github.com/streamr-dev/streamr-docker-dev/blob/master/README.md#setting-up).
2. Start **Streamr development environment**
   ```bash
   streamr-docker-dev start --wait
   ```
3. Wait until all services are up and running.
4. In the root of this repo run:
   ```bash
   docker compose upN
   ```
5. Deploy `StorageManager` contracts
   ```bash
   cd ./packages/contracts
   npx hardhat run ./scripts/deployStoreManager.ts --network streamr-dev
   ```

## Connect with us

[Join us on Discord](https://go.usher.so/etl-network-discord)
