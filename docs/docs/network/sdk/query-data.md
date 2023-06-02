---
title: "Query Data"
sidebar_position: 4
---

# Query Data

## API

### `queryStake`

```ts
function queryStake(amount: BigNumberish, options = { usd: false })
```

Stakes the specified amount of funds in order to perform queries. 

- `amount` is a `BigNumberish` type
- `options` is an object with a single optional property, `usd`, which is a boolean indicating whether the amount is in USD.

### `query`
    
```ts
function query(streamDefinition: StreamDefinition, options: QueryOptions, onMessage?: MessageListener)
```

Queries a stream for historical data.

- `streamDefinition` is an object containing the stream ID and partition that should be queried.
- `options` is an object that defines the query options.
- `onMessage` is an optional callback function for each message retrieved from the stream.

Returns a Promise that resolves to a `MessageStream` object, providing an alternative way of iterating through the messages.

## Example

```ts
import LogStoreClient from "@concertodao/logstore-client";

const logStoreClient = new LogStoreClient({
  auth: {
    privateKey: 'your-private-key',
  },
});

// Staking some funds for the purpose of making a query
await logStoreClient.queryStake(STAKE_AMOUNT);

const queryResult = await logStoreClient.query(myStreamId, { 
	from: {
		timestamp: 1685272949531
	}, 
	to: {
		timestamp: 1685272962273
	} 
});
```