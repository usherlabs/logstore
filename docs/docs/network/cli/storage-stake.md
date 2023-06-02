---
title: "Storage Stake"
sidebar_position: 2
---

# Storage Stake

To enable data from a stream to be stored, some stake is required for storing that stream:

```bash
logstore-cli store stake <streamId> --amount 100 --usd -h https://node1.logstore.usher.so -w ...
```

This will stake 100 USD worth of tokens into the Store Manager Contract for the specified Stream ID.

This will start the storage of all events transported over that stream.