---
title: "Authentication"
sidebar_position: 2
---

# Authentication

## Using a Private Key

```ts
const logStoreClient = new LogStoreClient({
  auth: {
    privateKey: 'your-private-key',
  },
});
```

Private keys can also be generated using `LogStoreClient.generateEthereumAccount()`.

## Using a Web3 Provider

```ts
const logStoreClient = new LogStoreClient({
  auth: {
    ethereum: window.ethereum,
  },
});
```

You can also create an anonymous client instance that can interact with public streams:

```ts
const streamr = new LogStoreClient();
```