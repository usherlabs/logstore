---
title: "Query Stake"
sidebar_position: 3
---

# Query Stake

Before the log store can be queried, some amount needs to be staked by the consumer:

```bash
logstore-cli query stake --amount 100 --usd -h https://node1.logstore.usher.so
```

This will stake 100 USD worth of tokens into the Query Manager Contract.

This will enable query requests to be made for data stored in any stream.

Queries will not be able to decrypt private streams without appropriate Streamr stream access permissions.