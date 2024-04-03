# LogStore DevNetwork - Setup

## On a server to host the DevNetwork

1. Install and start Docker service.

2. Clone `streamr-docker-dev` repo:

   ```bash
   git clone git@github.com:usherlabs/streamr-docker-dev.git
   ```

   change into that directory:

   ```bash
   cd streamr-docker-dev
   ```

3. Add `streamr-docker-dev` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/streamr-docker-dev/bin.sh /usr/local/bin/streamr-docker-dev
   ```

4. Clone `logstore` repo:

   ```bash
   git clone git@github.com:usherlabs/logstore.git
   ```

   change into that directory:

   ```bash
   cd logstore
   ```

   switch to `develop` branch:

   ```bash
   git switch develop
   ```

   init and update git submodules:

   ```bash
   git submodule init && git submodule update
   ```

5. Add `dev-network` into a suitable directory in your PATH (run from repository root), e.g.:

   ```bash
   ln -sf $(pwd)/dev-network/bin/bin.sh /usr/local/bin/dev-network
   ```

6. Ensure that `ifconfig` is installed - [https://linuxhint.com/fix-ifconfig-command-not-found-linux/](https://linuxhint.com/fix-ifconfig-command-not-found-linux/)

7. Ensure that [`docker`](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04) and [`docker compose`](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-22-04) are installed and that Docker can be [managed as a non-root user](https://docs.docker.com/engine/install/linux-postinstall/).

8. Bind the internal IP address 10.200.10.1 to the loopback interface by modifying `netplan` configuration file located in `/etc/netplan/` directory. You'll find one or more YAML files in this directory. Choose the appropriate file to edit. The file might have a name like `01-netcfg.yaml`, `50-cloud-init.yaml`, or something similar. It's recommended to choose the file that ends with `.yaml`. Inside the YAML file, you'll see network configurations. Add a new section for the loopback interface `lo:` as in the examle:

   ```yaml
   network:
     ethernets:
       lo:
         addresses:
           - 10.200.10.1/32:
               label: 'lo:1'
   ```

   Apply the changes by running:

   ```bash
   sudo netplan apply
   ```

9. Run the DevNetwork:

   ```bash
   dev-network start -l
   ```

## On a developer's machine

1. Clone `logstore` repo

   ```bash
   git clone git@github.com:usherlabs/logstore.git
   ```

   change into that directory

   ```bash
   cd logstore
   ```

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

4. Connect to the DevNetwork:
   ```bash
   dev-network connect
   ```

## Manage the DevNetwork running on a VPS

If you are connecting to the DevNetwokr running on a VPS, it is possible to manage it right from a developer's machine. To do that you need to follow the steps explained above, and run a corresponding subcommand:

- Start:
  ```bash
  dev-network start
  ```
- Stop:
  ```bash
  dev-network stop
  ```
- Restart:
  ```bash
  dev-network restart
  ```
- Build the ParityNode docker image if there are any changes to the contracts. The DevNetwork has to be restarted then to use the new image:
  ```bash
  dev-network build
  ```
