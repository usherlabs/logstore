---
sidebar_position: 1
title: 'Overview'
slug: '/'
---

# Overview

Welcome to LogStore, a next-generation, decentralized time-series database. We've built a permissionless platform that allows you to publish event data from any software environment and query data between two timestamps. Our system ensures your data is permanently stored, cached, verifiably tamper-proof, and highly available.

## **The Power of Decentralization**

LogStore harnesses the power of decentralized architecture, distributing workloads across multiple nodes to enable infinite scalability and redundancy without significant penalties. Your data remains safe, with integrity maintained, and the network scales effortlessly as new nodes join the network.

We're proud of our collaborations with the [Streamr](https://streamr.network/) Network and the [Kyve](https://www.kyve.network/) Network, essential technologies that power our network. Streamr's data publishing speed and efficiency breakthroughs, as outlined in their **[Performance and Scalability Whitepaper](https://blog.streamr.network/streamr-network-performance-and-scalability-whitepaper/)**, are integral to our operations, enabling real-time data publishing to reach anywhere in the network in less than a third of a second.

Kyve's network, on the other hand, provides consensus over data stored by LogStore in [Arweave's Blockchain](https://www.arweave.org/), contributing to the verifiability and tamper-proof nature of our database. It ensures the validity of data from the point of capture to storage and query-ability.

## **Brokers and Validators: Our Two-Layer Approach**

At the heart of LogStore's functionality are two layers: Brokers and Validators. Brokers participating in the Streamr Network cache all data transport over registered Streamr data streams and coordinate to produce verifiable responses to each query request. Validators participating in the Kyve Network observe, store, and report on data that occurs within the Broker layer.

Together, these layers form a robust system that guarantees tamper-proof data transported and stored from any source. For an in-depth understanding of these layers, please refer to our **[Primer](https://docs.logstore.usher.so/primer)**.

## **Key Functions**

- **Data Storage**: LogStore's time-series data storage platform is secure and efficient, permitting you to store events emitted from any device.
- **Data Querying**: Fetching data from LogStore between any two timestamps is as simple as it can be. You are assured of receiving highly available and safe results.

## **AlphaNet: The first release of the Network**

We're thrilled to introduce AlphaNet, the first release of the Log Store Network which uses its own token, **LSAN** — necessary to enable compatibility with MainNet environments, while giving us the control we need to ensure secure operation of our early alpha software. Stay tuned for updates, and check out the **[AlphaNet](https://docs.logstore.usher.so/alphanet)** section for more details.

## **Getting Started with LogStore**

Ready to dive in? By following these steps you’ll be able to participate in our network, store data, and query data:

1. **Mint LSAN Tokens**: LSAN tokens are the fundamental fuel that powers the capabilities of LogStore. Start by minting your tokens with **MATIC**.
2. **Stake LSAN Tokens**: Fund the network by staking your LSAN tokens. This staking allows you to store or query data. We use dynamic pricing to ensure fair compensation to the network based on the data services you utilize.
3. **Store and Query Data**: Use our interfaces to store and query data as per your application's needs.

### LogStore interfaces

Our detailed documentation on SDK, CLI, and API is designed to guide you every step of the way:

- **LogStore SDK**: With our SDK, you can seamlessly integrate LogStore's capabilities into your software application. You can stake tokens and also store and query data using it.<br/>
	[Learn more →](./sdk/getting-started)
- **LogStore CLI**: Our Command-Line Interface (CLI) tool lets you mint and stake LSAN tokens from your terminal.<br/>
	[Learn more →](./cli/getting-started)
- **LogStore HTTP API**: Our HTTP API provides an interface for interacting with LogStore over the web. It offers a set of HTTP endpoints retrieving data, and there’ll be more functionalities soon. It’s ideal for integrating with any application, Oracle Network, or Smart Contract platform compatible with HTTP interfaces.<br/>
	[Learn more →](./api/getting-started)

## About Usher Labs

Usher Labs is at the forefront of creating software for Web3 and Blockchain, focusing on the management of digital assets using custom data. Our mission is to provide a secure and free management system for digital assets based on digital interactions and signals.

The Log Store Network is our solution. It offers secure and permanent storage for event data. This data is indexed and is searchable over time, providing a robust infrastructure for data management.

The infrastructure also supports Usher, our Web3-integrated referral marketing platform. Usher enables Brands to fund campaigns using digital assets. These assets are then redistributed to wallets that have successfully performed referrals.

[Learn more about Usher →](https://usher.so/)

## Stay Connected

Join our vibrant community on **[Discord](https://go.usher.so/discord)** and **[Twitter](https://twitter.com/usher_web3)
**. Stay updated, ask questions, share your experiences, and help us build a more robust, efficient, and secure decentralized event/atomic data storage and retrieval ecosystem.
