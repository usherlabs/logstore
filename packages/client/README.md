# Logstore Client

The `LogStoreClient` adds functionality for interacting with LogStore and has the following methods.

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

### `**async queryStake(amount: BigNumberish, options = { usd: false })**`

Stakes the specified amount of funds in order to perform queries. **`amount`** is a **`BigNumberish`** type and **`options`** is an object with a single optional property, **`usd`**, which is a boolean indicating whether the amount is in USD. 

### **`async query(streamDefinition: StreamDefinition, options: QueryOptions, onMessage?: MessageListener)`**

Queries a stream for historical data.

**`streamDefinition`** is an object containing the stream ID and partition that should be queried. **`options`** is an object that defines the query options.

**`onMessage`** is an optional callback function that is called for each message retrieved from the stream.

Returns a Promise that resolves to a **`MessageStream`** object that provides an alternative way of iterating through the messages.

### **`async addStreamToLogStore(streamIdOrPath: string, amount: BigNumberish)`**

Adds a stream to LogStore.

**`streamIdOrPath`** is the ID or path of the stream to be added. 

**`amount`** is a **`BigNumberish`** type representing the amount to be staked on the stream.

### **`async removeStreamFromLogStore(streamIdOrPath: string)`**

Removes a stream from LogStore.

**`streamIdOrPath`** is the ID or path of the stream to be removed. 

### **`async isLogStoreStream(streamIdOrPath: string)`**

Checks if a stream is assigned to a storage node. 

**`streamIdOrPath`** is the ID or path of the stream to check.

### **`async getLogStoreStreams()`**

Gets all streams assigned to a storage node. 

Returns a Promise that resolves to an object with a **`blockNumber`** property indicating the current blockchain state and a **`Stream[]`** property representing the list of streams stored on LogStore nodes.