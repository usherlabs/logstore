The log store network has a number of contracts which enable seamless participation in the network or withdrawal from the network, storage and retrieval of data across the network, and the fair distribution of incentives to nodes that exhibit exemplary behaviour on the network.

The contracts and their properties are as follows:

## Contract Documentation: LogStoreNodeManager

The `LogStoreNodeManager` contract is responsible for managing the nodes that are participating in the LogStore system. This contract allows for adding, removing, and updating nodes, as well as controlling access to the system via a whitelist.

## Contract Variables

**`requiresWhitelist`** is a boolean indicating whether a whitelist is required for nodes to participate in the system.

**`totalSupply`** is the total amount of tokens in circulation.

**`treasurySupply`** is the total amount of tokens held in the treasury.

**`stakeRequiredAmount`** is the amount of tokens required to be staked in order to become a node.

**`stakeTokenAddress`** is the address of the ERC-20 token used for staking.

**`totalNodes`** is the total number of nodes in the system.

**`nodes`** is a mapping of **`Node`** structs to node addresses.

**`whitelist`** is a mapping of node addresses to their **`WhitelistState`** (Approved, Rejected, or None).

**`balanceOf`** is a mapping of addresses to their token balance.

**`delegatesOf`** is a mapping of addresses to a mapping of delegate addresses to the amount of tokens they control.

**`headNode`** is the address of the first node in the linked list.

**`tailNode`** is the address of the last node in the linked list.

**`systemStreamId`** is a string representing the system stream ID.

**`stakeToken`** is an **`IERC20Upgradeable`** instance representing the staking token.

**`_storeManager`** is an instance of the **`LogStoreManager`** contract.

**`_queryManager`** is an instance of the **`LogStoreQueryManager`** contract.

**`_reportManager`** is an instance of the **`LogStoreReportManager`** contract.

**`streamrRegistry`** is an instance of the **`IStreamRegistry`** interface.

## Contract Functions

### `initialize`

```
function initialize(
    address owner_,
    bool requiresWhitelist_,
    address stakeTokenAddress_,
    uint256 stakeRequiredAmount_,
    address streamrRegistryAddress_,
    address[] memory initialNodes,
    string[] calldata initialMetadata
) public initializer

```

- `owner_`: The address that will own the contract.
- `requiresWhitelist_`: A flag indicating whether or not a whitelist is required for access to the system.
- `stakeTokenAddress_`: The address of the token used for staking.
- `stakeRequiredAmount_`: The amount of tokens required for staking.
- `streamrRegistryAddress_`: The address of the Streamr Registry.
- `initialNodes`: An array of addresses representing the initial nodes in the system.
- `initialMetadata`: An array of strings representing the metadata associated with each of the initial nodes.

Initializes the contract and sets the contract owner, requiresWhitelist, stakeTokenAddress, stakeRequiredAmount, and the Streamr registry. It also creates the system stream ID and sets the initial nodes and their metadata.

### `registerStoreManager`

```
function registerStoreManager(address contractAddress) public onlyOwner

```

- `contractAddress`: The address of the contract to be registered.

Sets the contract address for the LogStoreManager contract.

### `registerQueryManager`

```
function registerQueryManager(address contractAddress) public onlyOwner

```

- `contractAddress`: The address of the contract to be registered.

Sets the contract address for the LogStoreQueryManager contract.

### `registerReportManager`

```
function registerReportManager(address contractAddress) public onlyOwner

```

- `contractAddress`: The address of the contract to be registered.

Sets the contract address for the LogStoreReportManager contract.

### `upsertNodeAdmin`

```
function upsertNodeAdmin(address node, string calldata metadata_) public onlyOwner

```

- `node`: The address of the node to be updated.
- `metadata_`: The metadata associated with the node.

Adds a new node to the system or updates the metadata associated with an existing node.

### `removeNodeAdmin`

```
function removeNodeAdmin(address nodeAddress) public onlyOwner

```

- `nodeAddress`: The address of the node to be removed.

Removes a node from the system.

### `treasuryWithdraw`

```
function treasuryWithdraw(uint256 amount) public onlyOwner

```

- `amount`: The amount of tokens to be withdrawn from the treasury.

Allows the contract owner to withdraw tokens from the treasury.

## Contract Events

### `NodeUpdated`

```
event NodeUpdated(address indexed nodeAddress, string metadata, uint indexed isNew, uint lastSeen);

```

- `nodeAddress`: The address of the updated node.
- `metadata`: The metadata associated with the node.
- `isNew`: A flag indicating whether or not the node is new.
- `lastSeen`: The timestamp when the node was last seen.

Emitted when a node is updated.

### `NodeRemoved`

```
event NodeRemoved(address indexed nodeAddress);

```

- `nodeAddress`: The address of the removed node.

Emitted when a node is removed.

### `NodeStakeUpdated`

```
event NodeStakeUpdated(address indexed nodeAddress, uint stake);

```

## Contract Documentation: LogStoreQueryManager

The `LogStoreQueryManager` contract is owned by the `NodeManager` contract and controls the capture of funds for a given query and the staking of tokens. It is designed to work with the Open Zeppelin libraries for controlling upgradability and access.

## Contract Details

### Contract Variables

- `totalSupply`: total supply of tokens staked.
- `stakeTokenAddress`: address of the token used for staking.
- `balanceOf`: a mapping of addresses and their total balance.
- `stakeToken`: an instance of the `IERC20Upgradeable` interface to interact with the staking token.

### Contract Events

- `DataQueried`: triggered when a query is captured, and data is queried. It logs the `consumer` address, `fees` paid, and the number of `bytesProcessed`.
- `Stake`: triggered when a user stakes an amount of tokens. It logs the user's address and the `amount` of tokens staked.

### Contract Functions

### `initialize`

```
function initialize(address owner_, address stakeTokenAddress_) public initializer

```

This function initializes the contract by setting the owner and the staking token address. It requires that the `stakeTokenAddress_` parameter is not `address(0)`.

- `owner_`: address of the contract owner.
- `stakeTokenAddress_`: address of the staking token.

### `_authorizeUpgrade`

```
function _authorizeUpgrade(address) internal override onlyOwner {}

```

This function is required by the OZ UUPS module to authorize upgrades only by the owner.

### `capture`

```
function capture(address consumer, uint256 amount, uint256 bytesProcessed) public nonReentrant onlyOwner

```

This function captures funds for a given query. Only the LogStore contract can call the capture method. It requires that the `amount` is less than or equal to the balance of the staking token held by the contract. It decreases the `balanceOf` the `consumer` address by the `amount`, decreases the `totalSupply` by the `amount`, and transfers the `amount` of staking tokens to the caller. It then emits a `DataQueried` event with the `consumer` address, `fees` paid, and the number of `bytesProcessed`.

- `consumer`: address of the data consumer.
- `amount`: amount of tokens to capture.
- `bytesProcessed`: number of bytes in the response.

### `stake`

```
function stake(uint amount) public nonReentrant

```

This function allows users to stake tokens. It requires that the `amount` is greater than 0. It increases the `balanceOf` the caller's address by the `amount`, increases the `totalSupply` by the `amount`, and transfers the `amount` of staking tokens from the caller to the contract. It then emits a `Stake` event with the caller's address and the `amount` of tokens staked.

- `amount`: amount of tokens to stake.

## Conclusion

The `LogStoreQueryManager` contract is a crucial part of the LogStore system. It allows users to stake tokens and enables capturing funds for a given query. It is designed to work with the Open Zeppelin libraries for controlling upgradability and access, making it secure and upgradable in the future.

# LogStoreReportManager

## Contract documentation: LogStoreReportManager

## Overview

This contract is responsible for accepting and processing log reports from nodes on the LogStore network. The reports contain information about streams, nodes, delegates, and consumers, as well as a treasury supply change. The contract verifies the reports, stores them, and emits an event for each valid report it receives.

## Contract Functions

### `initialize(address _owner, uin256 _reportTimeBuffer)`

This function initialises the contract by setting the `_owner` parameter as the owner of the contract. It also initialises the `LogStoreNodeManager` contract and sets the `_reportTimeBuffer` to 60.

Parameters:

- `_owner`: the address that will be set as the owner of the contract

### `getReport(string calldata id)`

This function returns a `Report` struct for a given report ID.

Parameters:

- `id`: the ID of the report

Returns:

- a `Report` struct containing information about the report

### `getLastReport()`

This function returns the most recent report that was accepted by the contract.

Returns:

- a `Report` struct containing information about the most recent report

### `processReport(string calldata id)`

This function marks a report as processed, which prevents it from being processed again in the future.

Parameters:

- `id`: the ID of the report to mark as processed

### `report()`

This function allows nodes to submit reports to the contract. It verifies the reports, stores them, and emits an event for each valid report it receives.

Parameters:

- `id`: the ID of the report
- `blockHeight`: the block height at which the report was submitted
- `streams`: an array of stream IDs
- `writeCaptureAmounts`: an array of integers representing the write capture amounts for each stream
- `writeBytes`: an array of integers representing the number of bytes written to each stream
- `readConsumerAddresses`: an array of consumer addresses
- `readCaptureAmounts`: an array of integers representing the read capture amounts for each consumer
- `readBytes`: an array of integers representing the number of bytes read by each consumer
- `nodes`: an array of node addresses
- `nodeChanges`: an array of integers representing the amount of change for each node
- `delegates`: an array of delegate addresses
- `delegateNodes`: an array of arrays representing the nodes controlled by each delegate
- `delegateNodeChanges`: an array of arrays representing the amount of change for each node controlled by each delegate
- `treasurySupplyChange`: the change in the treasury supply
- `addresses`: an array of addresses for verification
- `signatures`: an array of signatures for verification

Modifiers:

- `onlyStaked`: restricts access to nodes that have staked tokens

### `onlyStaked()`

This modifier restricts access to nodes that have staked tokens. It is used in the `report()` function.

## Contract Structs

### `Consumer`

This struct represents a consumer of a stream.

Fields:

- `id`: the address of the consumer
- `readCapture`: the read capture amount for the consumer
- `readBytes`: the number of bytes read by the consumer

### `Stream`

This struct represents a stream.

Fields:

- `id`: the ID of the stream
- `writeCapture`: the write capture amount for the stream
- `writeBytes`: the number of bytes written to the stream

### `Node`

This struct represents a node.

Fields:

- `id`: the address of the node
- `amount`: the amount of change for the node

### `Delegate`

This struct represents a delegate.

Fields:

- `id`: the address of the delegate
- `nodes`: the nodes that the delegate is associated with.

### `Report`

This struct represents a report generated from the submission process

- **`string id`**: the identifier of the report.
- **`uint256 height`**: the height of the report.
- **`int256 treasury`**: the amount of data held in the treasury.
- **`Stream[] streams`**: the streams associated with the report.
- **`Node[] nodes`**: the nodes associated with the report.
- **`Delegate[] delegates`**: the delegates associated with the report.
- **`Consumer[] consumers`**: the consumers associated with the report.
- **`address _reporter`**: the Ethereum address of the reporter who submitted the report.
- **`bool _processed`**: a flag indicating whether the report has been processed.

## Contract **Events**

### **`ReportAccepted(string raw)`**

Emitted when a report is accepted

## Contract Documentation: LogStoreManager

### Introduction

LogStoreManager is a smart contract that manages the staking and capturing of stake tokens for Streamr data streams. It is owned by the NodeManager contract and interfaces with the StreamrRegistry contract to validate stream existence. This contract is designed to be upgradable and uses the Open Zeppelin libraries for access control, reentrancy protection, and upgradability.

## Contract Variables

- **`totalSupply`**: Total amount of tokens staked in the contract.
- **`stakeTokenAddress`**: Address of the token used for staking.
- **`stores`**: Mapping of store ids to their total balance.
- **`storeStakeholders`**: Mapping of store ids to an array of addresses that have staked in the store.
- **`balanceOf`**: Mapping of addresses to their total balance.
- **`storeBalanceOf`**: Mapping of addresses to the stores they have staked in and their corresponding balance.
- **`stakeToken`**: Instance of the token used for staking.
- **`streamrRegistry`**: Instance of the StreamrRegistry contract.

## Contract Functions

### initialize

```
function initialize(
    address owner_,
    address stakeTokenAddress_,
    address streamrRegistryAddress_
) public initializer

```

The `initialize` function initializes the contract and sets its owner, stakeTokenAddress, and streamrRegistryAddress. It is called once during contract deployment and is only callable by the contract owner.

Parameters:

- `owner_`: the address of the contract owner
- `stakeTokenAddress_`: the address of the stake token contract
- `streamrRegistryAddress_`: the address of the StreamrRegistry contract

### exists

```
function exists(string calldata streamId) public view returns (bool)

```

The `exists` function checks if a given Streamr data stream exists in the contract.

Parameters:

- `streamId`: the ID of the Streamr data stream

Returns:

- `bool`: whether or not the stream exists

### capture

```
function capture(string memory streamId, uint256 amount, uint256 bytesStored) public returns (bool success)

```

The `capture` function allows a LogStore contract to capture stake tokens for a Streamr data stream. The function determines the fee amounts proportional to each stakeholder stake amount and updates the balanceOf, storeBalanceOf, storeStakeholders, and stores mappings accordingly.

Parameters:

- `streamId`: the ID of the Streamr data stream
- `amount`: the amount of stake tokens being captured
- `bytesStored`: the number of bytes stored for the captured data

Returns:

- `bool`: whether or not the stake tokens were successfully transferred

### stake

```
function stake(string memory streamId, uint amount) public

```

The `stake` function allows a user to stake tokens for a Streamr data stream. The function validates the existence of the Streamr data stream and transfers the stake tokens from the user to the contract. The function then updates the storeStakeholders, storeBalanceOf, and stores mappings accordingly.

Parameters:

- `streamId`: the ID of the Streamr data stream
- `amount`: the amount of stake tokens being staked

## Events

### StoreUpdated

```
event StoreUpdated(string store, bool isNew, uint256 amount);

```

The `StoreUpdated` event is emitted when a new Streamr data stream is added to the contract or when the balance of an existing Streamr data stream is updated.

Parameters:

- `store`: the ID of the Streamr data stream
- `isNew`: a boolean indicating if the Streamr data stream is new
- `amount`: the amount of stake tokens being staked or captured

### DataStored

```
event DataStored(string store, uint256 fees, uint256 bytesStored);

```

The `DataStored` event is emitted when stake tokens are captured for a Streamr data stream.

Parameters:

- `store`: the ID of the Streamr data stream
- `fees`: the amount of stake tokens being captured
- `bytesStored`: the number of bytes stored for the captured data

# LSAN

## Price Management

Get MATIC & WEI per Byte - `pnpm price:byte`

Get Token Price for Network - `pnpm price:token --network streamr-dev`
