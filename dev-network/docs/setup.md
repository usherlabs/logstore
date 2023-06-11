# LogStore DevNetwork - Setup

## On a server to host the DevNetwork

1. Install and start Docker service.

1. Clone `streamr-docker-dev` repo: `git clone git@github.com:streamr-dev/streamr-docker-dev.git`, change into that directory `cd streamr-docker-dev`

1. Add `streamr-docker-dev` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/streamr-docker-dev/bin.sh /usr/local/bin/streamr-docker-dev
   ```

1. Clone this repo: `git clone git@github.com:usherlabs/logstore.git`, change into that directory `cd logstore`

1. Add `dev-network` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/dev-network/bin/bin.sh /usr/local/bin/dev-network
   ```

1. Run the DevNetwork

   ```bash
   dev-network start -l
   ```

## On a developer's machine

1. Clone this repo: `git clone git@github.com:usherlabs/logstore.git`, change into that directory `cd logstore`

1. Add `dev-network` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/dev-network/bin/bin.sh /usr/local/bin/dev-network
   ```

1. Configure the connection to the DevNetwork server:

   ```bash
   dev-network config set -i 10.0.0.1 -u ubuntu -i /home/ubuntu/.ssh/id_rsa.pub
   ```

1. Add to `/etc/hosts` file the following line to redirect http requests to `arweave.net` to the DevNetwork

   ```
   127.0.0.1   arweave.net
   ```

1. Connect to the DevNetwork:
   ```bash
   dev-network connect
   ```
