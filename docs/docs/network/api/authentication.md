---
title: "Authentication"
sidebar_position: 2
---

# Authentication

### Basic Authentication

In the context of the LogStore API, Basic Authentication is used. The user and the signature are extracted from the **`authorization`** header. The username is the consumer's wallet address and the password is its signature, both encoded in Base64 format. The format is **`basic {Base64 encoded walletAddress:signature}`**.

```sh title="cURL Example"
curl 	--request GET 'https://api.logstore.usher.so/...' \
		--header 'authorization: basic Y2F0ZWdvcnkwMzQwMjQwMzQwMjQwMzQ'
```

### Ethereum-based Authentication

For additional security, LogStore utilizes Ethereum addresses for user identification. The signature in the **`authorization`** header is verified against the user's Ethereum address, ensuring the authenticity of the request.

### Errors

If a request is not properly authenticated, it will result in an error. You should expect HTTP `401 Unauthorized` and HTTP `403 Forbidden` responses. If the user has insufficient funds to fulfill a particular request, it will be dropped with a `401 Unauthorized` status.

### Best Practices

While interacting with the LogStore API, follow these best practices to ensure a secure and reliable experience:

- **Safeguard your keys**: Keep your API keys secure and use them properly in different environments. Never share your keys in publicly accessible areas or client-side code.
- **Use HTTPS**: To protect the integrity and confidentiality of the data being transmitted, always use HTTPS when making API requests.
- **Implement Ethereum-based authentication securely**: When implementing Ethereum-based authentication, ensure the user's Ethereum address matches the address derived from the signature in the **`authorization`** header. This verifies the authenticity of the request and the identity of the user.
