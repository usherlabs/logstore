---
sidebar_position: 2
title: 'Primer'
---

# Primer

On-chain computation has restricted bandwidth to data that occurs off-chain.
Custom data is pulled on-chain via APIs that are typically centralised - requiring trust in data integrity.

The Log Store Network is a technology to cryptographically secure the movement of data from any device to the Arweave blockchain network - enabling a pure data store for events indexed and query-able by time.

Smart Contracts can now request custom off-chain event data through an Oracle Network with pure data integrity.
Traditional systems can now cooperate on data without intermediaries.

The technology leverages the Streamr Network for global transport of data, the Arweave Blockchain for permanent storage of data, the Kyve Network for consensus over data stored, and custom integration software embedded in Nodes and new Smart Contracts to deliver the solution in a decentralized and token-incentivized manner. The Log Store Network comprises two sub-networks bound by their own Blockchain systems, and interlinked via a Streamr stream that behaves as a communication mesh.

### Broker Network: The First Layer

The first layer of our technology is the Broker Network, where each Node is a Streamr Broker Node that has installed the `logStore` Plugin. This layer is effectively a decentralized version of the Streamr Broker Storage Plugin, whereby Nodes receive events over Streams, store those events into a local time-series database, and expose connections over HTTP for query-ability.

Log Store has taken a great effort to embed this layer within the Streamr framework. The developer experience should resemble Streamr’s quite closely. The Log Store Client package shares many of the same methods as the Streamr Client and only complements the Streamr Client with a new `query` method.

### Validator Network: The Second Layer

In order to guarantee the operational performance of the Broker layer, the second Validator layer is required. This Validator layer not only behaves as an authority over the Broker layer — determining which Nodes are rewarded and penalized, and how digital assets should be consumed from developers interacting with the network—but also behaves as the storage mechanism so that Streamr data is uploaded to Arweave in a fully decentralized manner.

The Validator layer builds upon the Kyve Network, a blockchain designed for yielding data lakes produced through consensus.

### Data Upload and Reporting Process

Once data is pushed to Arweave, a recursive process occurs. Nodes within the Broker layer are responsible for reading from this decentralized data lake and pushing reports to our Polygon Smart Contract. This reporting process takes heavy inspiration from Chainlink’s Off-Chain Reporting (OCR) strategy to minimize gas fees.

:::note
The full litepaper explaining the network, its consensus mechanisms, and more will release soon.

:::
