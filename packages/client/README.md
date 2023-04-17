Documentation for the Logstore Client :

The Logstore Client is a Javascript library which serves to adds functionality for interacting with LogStore and has the following methods.

### `c**onstructor(config?: LogStoreClientConfig)**`

This is the constructor for the `LogStoreClient` class. It takes an optional configuration object, `config` ****of type `LogStoreClientConfig`, which can be used to configure the client. .

```
import { StreamrClientConfig } from 'streamr-client';

export interface LogStoreClientConfig extends StreamrClientConfig {
	contracts?: StreamrClientConfig['contracts'] & {
		logStoreNodeManagerChainAddress?: string;
		logStoreStoreManagerChainAddress?: string;
		logStoreTheGraphUrl?: string;
	};
}
```

### `**queryStake(amount: BigNumberish, options = { usd: false })**`

Stakes the specified amount of funds in order to perform queries. **`amount`** is a **`BigNumberish`** type and **`options`** is an object with a single optional property, **`usd`**, which is a boolean indicating whether the amount is in USD. 

### **`query(streamDefinition: StreamDefinition, options: QueryOptions, onMessage?: MessageListener)`**

Queries a stream for historical data.

**`streamDefinition`** is an object containing the stream ID and partition that should be queried. **`options`** is an object that defines the query options.

**`onMessage`** is an optional callback function that is called for each message retrieved from the stream.

Returns a Promise that resolves to a **`MessageStream`** object that provides an alternative way of iterating through the messages.

### **`stakeOrCreateStore(streamIdOrPath: string, amount: BigNumberish)`**

Creates a stream in LogStore and/or stake some funds to the provided stream.

**`streamIdOrPath`** is the ID or path of the stream to be added. 

**`amount`** is a **`BigNumberish`** type representing the amount to be staked on the stream.

### **`async removeStreamFromLogStore(streamIdOrPath: string)`**

Removes a stream from LogStore.

**`streamIdOrPath`** is the ID or path of the stream to be removed. 

### **`isLogStoreStream(streamIdOrPath: string)`**

Checks if a stream is assigned to a storage node. 

**`streamIdOrPath`** is the ID or path of the stream to check.

### **`getLogStoreStreams()`**

Gets all streams assigned to a storage node. 

Returns a Promise that resolves to an object with a **`blockNumber`** property indicating the current blockchain state and a **`Stream[]`** property representing the list of streams stored on LogStore nodes.

## Code Examples and Snippets

```jsx
import { LogStoreClient } from '@concertodao/logstore-client';

// Initialize the logstore client
const logStoreClient = new LogStoreClient({
			auth: {
				privateKey: "0xabc123...",
			},
		});

// Create a new stream
const newStream = await logStoreClient.createStream({
		id: "domain/streamId",
	});

// Adding the stream to logstore and staking some tokens to it
await logStoreClient.addStreamToLogStore(newStream.id, STAKE_AMOUNT);

// Staking some funds for the purpose of making a query
await logStoreClient.queryStake(STAKE_AMOUNT)
```