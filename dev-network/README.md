# LogStore DevNetwork

## Enpoints

### Web applications

- [http://localhost:80](http://localhost:80) - Streamr APP
- [http://localhost:8801](http://localhost:8801) - KYVE APP

### Blockchains

- [http://localhost:8545](http://localhost:8545) - EVM Main chain (Chain ID: 8995)
- [http://localhost:8546](http://localhost:8546) - EVM Side chain (Chain ID: 8997)
- [http://localhost:1317](http://localhost:1317) - KYVE REST API
- [http://localhost:26657](http://localhost:26657) - KYVE RPC

### Databases

- [http://localhost:9042](http://localhost:9042) - Cassandra

### LogStore Brokers

- [http://localhost:7771](http://localhost:7771) - Broker #1
- [http://localhost:7772](http://localhost:7772) - Broker #2
- [http://localhost:7773](http://localhost:7773) - Broker #3

### Ports already in use

| Ports | Service                         | Container Name                       | Source   |
| ----- | ------------------------------- | ------------------------------------ | -------- |
| 25    | SMTP                            | streamr-dev-smtp                     | Streamr  |
| 80    | Streamr APP                     | streamr-dev-nginx                    | Streamr  |
| 443   | Streamr APP                     | streamr-dev-nginx                    | Streamr  |
| 1317  | KYVE REST API                   | logstore-kyve-nginx                  | LogStore |
| 3306  | MySql                           | streamr-dev-mysql                    | Streamr  |
| 3333  |                                 | streamr-dev-platform                 | Streamr  |
| 3334  |                                 | streamr-dev-network-explorer         | Streamr  |
| 4001  |                                 | streamr-dev-stream-metrics-index     | Streamr  |
| 5001  |                                 | streamr-dev-ipfs                     | Streamr  |
| 5432  |                                 | streamr-dev-postgres                 | Streamr  |
| 6379  | Redis                           | streamr-dev-redis                    | Streamr  |
| 6695  |                                 | streamr-dev-ipfs                     | Streamr  |
| 6688  |                                 | streamr-dev-chainlink-node           | Streamr  |
| 6691  |                                 | streamr-dev-chainlink-adapter        | Streamr  |
| 7000  | Cassandra                       | streamr-dev-cassandra                | Streamr  |
| 7001  | Cassandra                       | streamr-dev-cassandra                | Streamr  |
| 7199  | Cassandra                       | streamr-dev-cassandra                | Streamr  |
| 7771  | LogsStore Broker #1             | logstore-broker-1                    | LogStore |
| 7772  | LogsStore Broker #2             | logstore-broker-2                    | LogStore |
| 7773  | LogsStore Broker #3             | logstore-broker-3                    | LogStore |
| 8000  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8001  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8020  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8030  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8030  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8040  |                                 | streamr-dev-thegraph-node            | Streamr  |
| 8081  |                                 | streamr-dev-core-api                 | Streamr  |
| 8545  | EVM Main chain (Chain ID: 8995) | streamr-dev-parity-node0             | Streamr  |
| 8546  | EVM Side chain (Chain ID: 8997) | streamr-dev-parity-sidechain-node0   | Streamr  |
| 8451  | EVM Side chain (Chain ID: 8997) | streamr-dev-parity-sidechain-node0   | Streamr  |
| 8450  | EVM Main chain (Chain ID: 8995) | streamr-dev-parity-node0             | Streamr  |
| 8690  | Streamr Broker (no storage) #2  | streamr-dev-broker-node-no-storage-2 | Streamr  |
| 8691  | Streamr Broker (no storage) #2  | streamr-dev-broker-node-no-storage-2 | Streamr  |
| 8790  | Streamr Broker (no storage) #1  | streamr-dev-broker-node-no-storage-1 | Streamr  |
| 8791  | Streamr Broker (no storage) #1  | streamr-dev-broker-node-no-storage-1 | Streamr  |
| 8890  | Streamr Broker (storage) #1     | streamr-dev-broker-node-storage-1    | Streamr  |
| 8891  | Streamr Broker (storage) #1     | streamr-dev-broker-node-storage-1    | Streamr  |
| 8881  | KYVE APP                        | logstore-kyve-nginx                  | LogStore |
| 9000  | Streamr Broker (storage) #1     | streamr-dev-broker-node-storage-1    | Streamr  |
| 9042  | Cassandra                       | streamr-dev-cassandra                | Streamr  |
| 9100  | Streamr Broker (no storage) #1  | streamr-dev-broker-node-no-storage-1 | Streamr  |
| 9160  | Cassandra                       | streamr-dev-cassandra                | Streamr  |
| 9200  | Streamr Broker (no storage) #2  | streamr-dev-broker-node-no-storage-2 | Streamr  |
| 26657 | KYVE RPC                        | logstore-kyve-nginx                  | LogStore |
| 30301 | Streamr Tracker #1              | streamr-dev-tracker-1                | Streamr  |
| 30302 | Streamr Tracker #2              | streamr-dev-tracker-2                | Streamr  |
| 30303 | Streamr Tracker #3              | streamr-dev-tracker-3                | Streamr  |
| 30309 | EVM Main chain (Chain ID: 8995) | streamr-dev-parity-node0             | Streamr  |
| 30310 | EVM Side chain (Chain ID: 8997) | streamr-dev-parity-sidechain-node0   | Streamr  |
| 30315 | Streamr Broker (storage) #1     | streamr-dev-broker-node-storage-1    | Streamr  |
| 30316 | Streamr Broker (no storage) #1  | streamr-dev-broker-node-no-storage-1 | Streamr  |
| 30317 | Streamr Broker (no storage) #2  | streamr-dev-broker-node-no-storage-2 | Streamr  |
