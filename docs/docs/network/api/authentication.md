---
title: 'Authentication'
sidebar_position: 2
---

# Authentication

### Basic Authentication

In the context of the LogStore API, Basic Authentication is used. The user and the signature are extracted from the **`Authorization`** header.

- The username is the consumer's wallet address
- The password is a signature produced by the wallet address, whereby the signature payload is the wallet address.
  ```
  	const sig = signer.signMessage(walletAddress);
  ```

Both values are encoded in Base64 format. The format is **`basic {Base64 encoded walletAddress:signature}`**.

```sh title="cURL Example"
curl 	--request GET 'https://api.logstore.usher.so/...' \
		--header 'authorization: basic Y2F0ZWdvcnkwMzQwMjQwMzQwMjQwMzQ'
```

### Errors

If a request is not properly authenticated, it will result in an error. You should expect HTTP `401 Unauthorized` and HTTP `403 Forbidden` responses. If the user has insufficient funds to fulfill a particular request, it will be dropped with a `401 Unauthorized` status.

### Best Practices

While interacting with the LogStore API, follow these best practices to ensure a secure and reliable experience:

- **Safeguard your keys**: Keep your Private keys secure and use them properly in different environments. Never share your keys in publicly accessible areas or client-side code.
- **Use HTTPS**: To protect the integrity and confidentiality of the data being transmitted, always use HTTPS when making API requests.
- **Implement EVM-based authentication securely**: When implementing EVM-based authentication, ensure the user's Ethereum address matches the address derived from the signature in the **`authorization`** header. This verifies the authenticity of the request and the identity of the user.
