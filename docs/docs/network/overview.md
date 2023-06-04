---
sidebar_position: 1
title: 'Overview'
slug: '/'
---

# Overview

Log Store is a decentralized time-series database.

All data transported to and from Log Store is verifiably tamper-proof.

It can be used to

1. Publish event data from any device
2. Query event data between two timestamps

It’s formed by a network of nodes that come to a consensus about data validity from the point of data capture through to storage and query-ability.

The first layer of the network operates as **Brokers**,

1. participating in the Streamr Network,
2. caching all data transport over registered Streamr data streams,
3. forwarding Validator reports to Smart Contracts,
4. coordinating to produce verifiable responses to each query request

The second layer operates as **Validators**, participating in the Kyve Network. Validators observe, store, and report on data that occurs within the Broker layer. Validators write their data to Arweave for permanent storage and availability.

The outcome is tamper-proof data transported and stored from any source.

[Read the primer on how it works →](./primer.md)

### Store data

1. Register your Streamr streams into the LogStoreManager Smart Contract, where AlphaNet tokens can be staked to fund its storage.
2. Once registered, all stakeholders of the stream can also participate in staking to fund its storage.
3. As data is published to the Stream, the Log Store network will be responsible for
   1. First, caching the received data in a time-series format as to ensure high-availability
   2. Second, bundle and store all cached data onto Arweave

### Query data

1. Stake AlphaNet tokens into the LogStoreQueryManger Smart Contract.
2. Use the Log Store Network’s API to fetch data between any two timestamps.
3. Optionally, verify your query response.
   Each Query response will be accompanied by a series of signatures of each of the Nodes responsible for the response, meaning that you can verify that each response is truly the response of the entire network.

### AlphaNet

The Log Store AlphaNet will launch in June 2023, we do disclaim that this is very early software and that we may encounter bugs along the way.

For this reason, the AlphaNet will launch with its own custom ERC20 Token.

This will enable us to permission Node Operator access while also delivering compatibility with live Streamr streams and Arweave storage.

To obtain this Token so that you can get started and store or query data, a separate process will be involved for exchanging your MATIC for AlphaNet Tokens.

This exchange is only necessary to compensate the network for storing the data!

The solution is now nearing its first alpha release — being appropriately named the AlphaNet.

The AlphaNet is scheduled to release in June 2023, so stay tuned by connecting with the team over [Discord](https://go.usher.so/discord) and [Twitter](https://twitter.com/usher_web3)!
