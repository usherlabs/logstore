# LogStore DevNetwork - Setup

## On a server to host the DevNetwork

1. Install and start Docker service.

2. Clone `streamr-docker-dev` repo: `git clone git@github.com:streamr-dev/streamr-docker-dev.git`, change into that directory `cd streamr-docker-dev`

3. Add `streamr-docker-dev` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/streamr-docker-dev/bin.sh /usr/local/bin/streamr-docker-dev
   ```

4. Clone this repo: `git clone git@github.com:usherlabs/logstore.git`, change into that directory `cd logstore`

5. Add `dev-network` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/dev-network/bin/bin.sh /usr/local/bin/dev-network
   ```

6. Run the DevNetwork

   ```bash
   dev-network start -l
   ```

## On a developer's machine

1. Clone this repo: `git clone git@github.com:usherlabs/logstore.git`, change into that directory `cd logstore`

2. Add `dev-network` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/dev-network/bin/bin.sh /usr/local/bin/dev-network
   ```

3. Configure the connection to the DevNetwork server:

   ```bash
   dev-network config set -i 10.0.0.1 -u ubuntu -f /home/ubuntu/.ssh/id_rsa.pub
   ```

   1. Change `10.0.0.1` to the IP of the VPS running the DevNetwork
   2. Change `/home/ubuntu/.ssh/id_rsa.pub` to your Public SSH Key. **Make sure to use an absolute path.**

4. Add to `/etc/hosts` file the following line to redirect http requests to the DevNetwork

   For Broker interactions:

   ```bash
   127.0.0.1 	logstore-broker-1
   127.0.0.1 	logstore-broker-2
   127.0.0.1 	logstore-broker-3
   ```

   For Validator interactions:

   ```bash
   127.0.0.1   arweave.net
   127.0.0.1   sidechain
   127.0.0.1   logstore-kyve
   ```

   **Caveats for Validator operation**:

   1. If you intend to operate a Validator Node from your Local Machine, be sure to clean any `.env` variables from your `packages/validator` directory.
   2. Install `dotenv-cli` with `pnpm i -g dotenv-cli` to load the relevant `.env.validator-X` env files
   3. As per the `dev-network/assets/validator/start-in-docker.sh` - Run the Validator Node with `dotenv` in a similar manner to the following:

   ```bash
   dotenv -e ./.env.validator-1 -- ../../../packages/validator/dist/bin/logstore-validator.js start --pool 0 \
     --valaccount VALACCOUNT \
     --storage-priv STORAGE_PRIV \
     --chain-id kyve-local \
     --rpc http://logstore-kyve:26657 \
     --rest http://logstore-kyve:1317
   ```

   _The above runs the Validator from the `dev-network/assets/validator` directory._

5. Connect to the DevNetwork:
   ```bash
   dev-network connect
   ```
