# Log Store

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
