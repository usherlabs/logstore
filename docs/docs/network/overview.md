---
sidebar_position: 1
title: 'Overview'
slug: '/'
---

# Overview

The Log Store Network is a decentralized and permissionless time-series database.

Publish atomic event data from any software environment and query data with timestamps.

From the point data is captured and published to the network, it becomes immutable, permanently stored, and verifiably tamper-proof.

Web3 applications that leverage custom data managed by the Log Store Network can become trustlessly secure from compromised through data verification.

## The Purpose

The Log Store Network secures the use of custom data within Smart Contracts and other decentralized systems.

Typically, custom data is requested from centralised and siloed environments which exposes security risks associated to data integrity and data availability. Even when decentralised storage networks are utilised, centralised APIs that behave gateways to this data can remain points of compromise.
The team behind the Log Store experienced this issue first-hand whereby using custom data to manage the allocation of digital assets required trust in the entity managing the data.

The Log Store Network solves this problem by decentralising data management from the point of data capture, to storage and then to query.

By leveraging the simplicity of data transport over the [Streamr Network](https://streamr.network/), consensus-driven data validity facilitated by the [KYVE Network](https://www.kyve.network/) and guaranteed permanence and immutability of data with the [Arweave Blockchain](https://www.arweave.org/), the Log Store Network achieves it’s purpose.

## Data Validity & Verification

Verifying the validity data is the process of checking that some data meets a pre-programmed protocol.

An example of this can be demonstrated through a Web3-integrated CPC Advertising Campaign:

1. A Publisher responsible for surfacing an advertisement publishes a signed event when the Advertisement is clicked
2. The Advertiser subscribes to the data stream and publishes a counter-signature when the click yields a page visit - authorising payment for the click
3. Oracle Network
   1. queries the Log Store Network for the most recent set of events & signatures
   2. (_optional_) verifies the integrity of the query response to ensure data was indeed stored and managed in a zero-party manner (_by verifying signatures in to the response's `Consensus` header_)
   3. Yields a data model that a Smart Contract can use to process token re-allocation
4. Smart Contract
   1. verifies the addresses & signature of the Advertiser & Publisher
   2. allocates a portion of Advertiser funds to the Publisher for each authorised event
5. The Publisher can now withdraw their allocated tokens

## Brokers and Validators: Our Two-Layer Approach

At the heart of the Log Store's functionality are two layers: Brokers and Validators. Brokers participating in the Streamr Network cache all data transport over registered Streamr data streams and coordinate to produce verifiable responses to each query request. Validators participating in the Kyve Network observe, store, and report on data that occurs within the Broker layer.

Together, these layers form a robust system that guarantees tamper-proof data transported and stored from any source. For an in-depth understanding of these layers, please refer to our **[Primer](https://docs.logstore.usher.so/primer)**.

## Key Functions

- **Data Storage**: Log Store's time-series data storage platform is secure and efficient, permitting you to store events emitted from any device.
- **Data Querying**: Fetch data from the Log Store with timestamps. All query responses include an additional `Consensus` header - which is a set of signatures representing the network's verification of the response.

## AlphaNet: The first release of the Network

We're thrilled to introduce AlphaNet, the first release of the Log Store Network which uses its own token, **LSAN** — necessary to enable compatibility with MainNet environments, while giving us the control we need to ensure secure operation of our early alpha software. Stay tuned for updates, and check out the **[AlphaNet](https://docs.logstore.usher.so/alphanet)** section for more details.

## Getting Started

Ready to dive in? By following these steps you’ll be able to participate in our network, store data, and query data:

1. **Mint LSAN Tokens**: LSAN tokens are the fundamental fuel that powers the capabilities of Log Store. Start by minting your tokens with **MATIC**.
2. **Stake LSAN Tokens**: Fund the network by staking your LSAN tokens. This staking allows you to store or query data. We use dynamic pricing to ensure fair compensation to the network based on the data services you utilize.
3. **Store and Query Data**: Use our interfaces to store and query data as per your application's needs.

### Interfaces

Our detailed documentation on SDK, CLI, and API is designed to guide you every step of the way:

- **SDK**: With our SDK, you can seamlessly integrate Log Store's capabilities into your software application. You can stake tokens and also store and query data using it.<br/>
  [Learn more →](./sdk/getting-started.md)
- **CLI**: The Command-Line Interface (CLI) tool lets you mint and stake LSAN tokens from your terminal.<br/>
  [Learn more →](./cli/getting-started.md)
- **HTTP API**: The HTTP API provides an network interface for interacting with Log Store. It’s ideal for integrating with on-chain applications through Oracle Networks, or Smart Contract platforms compatible with HTTP interfaces.<br/>
  [Learn more →](./api/getting-started.md)

## About Usher Labs

Usher Labs is decentralizing custom data-driven digital asset management. The goal is to secure the conversion of digital interactions and signals into on-chain outcomes. The Log Store Network is the solution, offering a permanent and secure data store for event data, indexed and query-able by time. Prior to this development, Usher Labs released Usher, its Web3-integrated referral marketing platform - which demonstrates the need for such infrastructure as it involves the redistribution of digital assets between parties engaged in performance-based partnerships.

[Learn more about Usher →](https://usher.so/)

## Stay Connected

Join our vibrant community on **[Discord](https://go.usher.so/discord)** and **[Twitter](https://twitter.com/usher_web3)**. Stay updated, ask questions, share your experiences, and help us build a more robust, efficient, and secure decentralized event/atomic data storage and retrieval ecosystem.
