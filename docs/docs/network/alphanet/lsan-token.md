---
sidebar_position: 2
title: LSAN Token
---

# LSAN Token

The LSAN token, an ERC20 token exclusively developed for the LogStore AlphaNet, plays a pivotal role in ensuring secure and efficient data transactions on the network. Its primary function is facilitating seamless integration with live Streamr data streams and Arweave storage while providing controlled access to Node Operators. This token is indeed the heart of the LogStore AlphaNet, powering users' ability to store and retrieve data on the network.

## Acquiring LSAN Tokens

Participants can acquire LSAN tokens by depositing MATIC into the LogStore AlphaNet Smart Contract. The number of LSAN tokens credited is not directly translated but is calculated automatically based on the network's storage costs. This dynamic pricing model ensures that the participants compensate the network accurately for the data services utilized. In essence, this process is the "minting" of LSAN tokens.

[Learn how to mint LSAN with our CLI  →](../cli/getting-started)


## Transacting with LSAN Tokens

While the LSAN tokens can be transferred to other addresses, a robust whitelist/blacklist system is in place to manage permissions. During the lifecycle of AlphaNet, we’ve enabled a manner to add or remove addresses from the whitelist, which contains addresses permitted to send tokens to the blacklisted addresses. Similarly, the blacklist is a registry of addresses that can only receive tokens from the whitelisted addresses. This precautionary measure ensures that the LSAN tokens are used in accordance with the intended rules and constraints of the LogStore AlphaNet.

The only address that is intended to be blacklisted is the Log Store Network’s `LogStoreNodeManager.sol` Smart Contract, which manages incentives within the Broker layer of the network. This means that in order to participate as a Broker Node on the Log Store Network during the Alpha, the Node address must be granted permission.

Usher Labs, the team behind the Log Store, will begin granting access permission to Node Operators once the Network gathers enough utility and feedback to be considered stable and escalated to the BetaNet phase.
