---
title: "Getting Started"
sidebar_position: 1
---

# Getting Started

Welcome to the LogStore API, an HTTP API designed to facilitate efficient data storage and retrieval. Whether you're building a web application, mobile app, or a complex data processing system, our API can integrate seamlessly with your code to provide a robust and reliable storage solution.

### **Base URL**

To interact with the LogStore API, you'll need to send requests to a running API node. The base URL of our managed LogStore API is **`https://api.logstore.usher.so`** and it’s ready for usage.

### **Request and Response Format**

Requests to the LogStore API are made in the form of HTTP requests, and the response data is returned as JSON. Common HTTP response status codes like 200 (OK), 400 (Bad Request), and 500 (Internal Server Error) are used to indicate the success or failure of your request.

### **Prerequisites**

Before you can start using the LogStore API, there are a few things you need to know:

1. **Authentication**: To use the LogStore API, you'll need to authenticate your requests. This is done using your API keys. More information on this can be found in the **Authentication** section.
2. **Ethereum Wallet**: Given the Ethereum-based authentication mechanism, you'll need an Ethereum wallet to interact with the API. To perform queries it’s also necessary to have staked LSAN Tokens.

	[Learn more on how to stake LSAN at our CLI section →](../cli/getting-started.md)

### **Quickstart Guide**

Ready to make your first API call? Here's a simple example using JavaScript:

```js title="JS Example"
const axios = require('axios');
const API_BASE_URL = 'https://api.logstore.usher.so';

axios.get(`${API_BASE_URL}/my-endpoint`, {
    headers: {
        // replace with your actual API key
        'Authorization': 'Basic {Base64 encoded user:signature}'
    }
})
.then(response => {
    console.log(response.data);
})
.catch(error => {
    console.error(`Error: ${error}`);
});

```

This script sends a GET request to the `my-endpoint` endpoint. Replace `{Base64 encoded user:signature}` with your own user and signature in the format described in the [Authentication](./authentication.md) section.
