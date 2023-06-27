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

6. Ensure that `ifconfig` is installed - [https://linuxhint.com/fix-ifconfig-command-not-found-linux/](https://linuxhint.com/fix-ifconfig-command-not-found-linux/)

7. Ensure that legacy `docker-compose` is installed for compatibility with `streamr-docker-dev` - `sudo apt get docker-compose`

8. Ensure that [`docker`](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04) and [`docker compose`](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-22-04) are installed and that Docker can be [managed as a non-root user](https://docs.docker.com/engine/install/linux-postinstall/).

9. Run the DevNetwork

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

   _Requires Broker interactions_

   ```bash
   127.0.0.1   arweave.net
   127.0.0.1   sidechain
   127.0.0.1   logstore-kyve
   ```

   To learn more about Local Validator operation and testing, read the [validators.md](./validators.md).

5. Connect to the DevNetwork:
   ```bash
   dev-network connect
   ```
