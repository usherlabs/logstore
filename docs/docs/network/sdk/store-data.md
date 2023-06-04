---
title: 'Store Data'
sidebar_position: 3
---

# Store Data

## API

### `stakeOrCreateStore`

```ts
function stakeOrCreateStore(streamIdOrPath: string, amount: BigNumberish);
```

Creates a stream in LogStore and/or stake some funds to the provided stream.

- `streamIdOrPath` is the ID or path of the stream to be added.
- `amount` is a `BigNumberish` type representing the amount to be staked on the stream.

### `isLogStoreStream`

```ts
function isLogStoreStream(streamIdOrPath: string);
```

Checks if a stream is assigned to a storage node.

- `streamIdOrPath` is the ID or path of the stream to check.

### `getLogStoreStreams`

```ts
function getLogStoreStreams();
```

It gets all streams assigned to a storage node.

Returns a Promise that resolves to an object with a `blockNumber` property indicating the current blockchain state and a `Stream[]` property representing the list of streams stored on LogStore nodes.

## Example

```ts
import LogStoreClient from '@logsnclient';

const logStoreClient = new LogStoreClient({
	auth: {
		privateKey: 'your-private-key',
	},
});

// Create a new stream -- from StreamrClient
const newStream = await logStoreClient.createStream({
	id: 'domain/streamId',
});

// Adding the stream to logstore and staking some tokens to it.
// Tokens used to fund storage.
await logStoreClient.stakeOrCreateStore(myStreamId, STAKE_AMOUNT);

// Publish messages to this stream
logStoreClient.publish(myStreamId, {
	hello: 'world',
});
```
